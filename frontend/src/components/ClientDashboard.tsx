import React, { useEffect, useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api, { initializePayment, cancelClientApplication, fetchClientPlans } from '../services/api';
import RentToOwnForm from './forms/RentToOwnForm';
import PayToOwnForm from './forms/PayToOwnForm';
import { useToast } from '../context/ToastContext';

const fetchProperties = async () => {
  const { data } = await api.get('/client/properties');
  return data;
};

const fetchInterests = async (token: string | null) => {
  if (!token) return [];
  const { data } = await api.get('/client/interests');
  return data;
};

const ClientDashboard: React.FC = () => {
  const { showToast } = useToast();
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [showApplicationTypeModal, setShowApplicationTypeModal] = useState(false);
  const [selectedApplicationType, setSelectedApplicationType] = useState<string | null>(null);
  const [selectedApprovedInterest, setSelectedApprovedInterest] = useState<any>(null);
  const [selectedPlanForLedger, setSelectedPlanForLedger] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentModalError, setPaymentModalError] = useState<string | null>(null);
  
  const [planType, setPlanType] = useState('PAY_TO_OWN');
  const [initialDepositPercentage, setInitialDepositPercentage] = useState<number>(30);
  const [purchaseMode, setPurchaseMode] = useState<'MILESTONE' | 'FULL'>('MILESTONE');
  const [fullPaymentChoice, setFullPaymentChoice] = useState<'TRANCHES' | 'WIRE'>('TRANCHES');
  const [wireTransferDetails, setWireTransferDetails] = useState<any>(null);
  const [copiedWireDetails, setCopiedWireDetails] = useState(false);
  
  const [paymentSummary, setPaymentSummary] = useState<{
    isOpen: boolean;
    totalPrice: number;
    paymentAmount: number;
    percentage?: number;
    isFullPayment?: boolean;
    paymentMethod?: 'STRIPE' | 'WIRE';
    currency?: string;
    trancheInfo?: string;
    onProceed: () => void;
  } | null>(null);

  // Application Form State
  const [formData] = useState({
    employmentStatus: '',
    monthlyIncome: '',
    comments: ''
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const token = localStorage.getItem('clientToken');

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  const { data: properties, isLoading } = useQuery({
    queryKey: ['availableProperties'],
    queryFn: fetchProperties,
    enabled: !!token
  });

  const { data: interests, isLoading: isLoadingInterests } = useQuery({
    queryKey: ['myInterests'],
    queryFn: () => fetchInterests(token),
    enabled: !!token
  });

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['myPlans'],
    queryFn: fetchClientPlans,
    enabled: !!token
  });

  const customPaymentMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (amount > 999999.99) {
        throw new Error(`Payment amount of $${amount.toLocaleString()} exceeds Stripe's $999,999.99 single transaction limit. Please enter an amount under $999,999 or arrange a Bank Wire Transfer.`);
      }
      const result = await initializePayment({
        paymentPlanId: selectedPlanForLedger.id,
        amount,
        currency: selectedPlanForLedger.currency || 'USD',
        provider: 'stripe',
        callbackUrl: `${window.location.origin}/payment/verify`
      });
      return result;
    },
    onSuccess: (result) => {
      window.location.href = result.authorization_url;
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || "Failed to initialize payment.";
      setPaymentModalError(msg);
      showToast("Payment Failed", msg, "error");
    }
  });

  const submitInterestMutation = useMutation({
    mutationFn: async (payload: any = formData) => {
      setPaymentModalError(null);
      const { 
        initialDepositPercentage, 
        paymentMethod, 
        isFullPayment, 
        trancheCount, 
        trancheIndex,
        ...submittedData 
      } = payload;
      
      const { data } = await api.post('/client/interests', { 
        propertyId: selectedProperty.id, 
        submittedData,
        initialDepositPercentage,
        paymentMethod: paymentMethod || 'STRIPE',
        isFullPayment: !!isFullPayment,
        trancheCount: trancheCount || 1,
        trancheIndex: trancheIndex || 1,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['myInterests'] });
      queryClient.invalidateQueries({ queryKey: ['myPlans'] });
      setSelectedProperty(null);
      setShowApplicationTypeModal(false);
      setSelectedApplicationType(null);
      setPaymentSummary(null);
      setPaymentModalError(null);
      
      if (data.wireTransfer) {
        setWireTransferDetails(data.wireTransfer);
        showToast("Application & Wire Invoice Created", "Bank transfer invoice generated. Please review wire instructions.", "success");
      } else if (data.payment && data.payment.authorization_url) {
        showToast("Redirecting to Stripe", "Opening secure checkout...", "info");
        window.location.href = data.payment.authorization_url;
      } else {
        showToast("Application Submitted", "Application submitted successfully! Please wait for admin approval.", "success");
      }
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.error || error.message || "Failed to submit application";
      setPaymentModalError(errorMsg);
      showToast("Application Error", errorMsg, "error");
    }
  });

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/client/plans', 
        { propertyId: selectedApprovedInterest.propertyId, type: planType }
      );
      return data;
    },
    onSuccess: async (data) => {
      try {
        const result = await initializePayment({
          paymentPlanId: data.plan.id,
          amount: Number(data.invoice.amountDue),
          currency: data.plan.currency || 'USD',
          provider: 'stripe',
          callbackUrl: `${window.location.origin}/payment/verify`
        });
        showToast("Redirecting to Stripe", "Opening secure checkout...", "info");
        window.location.href = result.authorization_url;
      } catch (error: any) {
        const msg = error.response?.data?.error || error.message || "Plan created, but failed to initialize payment. Please contact support.";
        showToast("Payment Initialization Error", msg, "warning");
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || "Failed to create plan";
      showToast("Plan Creation Error", msg, "error");
    }
  });

  const cancelInterestMutation = useMutation({
    mutationFn: async (id: string) => {
      return cancelClientApplication(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myInterests'] });
      showToast("Application Cancelled", "Application cancelled successfully.", "info");
    },
    onError: (error: any) => {
      const msg = error.response?.data?.error || error.message || "Failed to cancel application";
      showToast("Cancellation Error", msg, "error");
    }
  });

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-light text-slate-100">Welcome to your <span className="font-semibold text-brand-primary">Dashboard</span></h1>
        <p className="text-slate-400 mt-2">Find a property, submit an application, and start your journey.</p>
      </div>

      {/* My Active Plans Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-slate-200 mb-4">My Active Plans</h2>
        {isLoadingPlans ? (
          <div className="text-slate-400">Loading plans...</div>
        ) : plans?.length === 0 ? (
          <div className="text-slate-500 bg-slate-900/30 p-6 rounded-2xl border border-slate-800">You don't have any active payment plans yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans?.map((plan: any) => {
              const currSymbol = plan.currency === 'USD' ? '$' : plan.currency === 'EUR' ? '€' : plan.currency === 'GHS' ? '₵' : '$';
              return (
                <div key={plan.id} className="glass-panel p-5 rounded-2xl border border-brand-primary/30 flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2 text-xs font-bold bg-brand-primary text-white rounded-bl-xl">{plan.type}</div>
                  {plan.property?.type && (
                    <div className="text-xs font-semibold text-brand-primary uppercase tracking-wider mt-1">{plan.property.type}</div>
                  )}
                  <h3 className="text-lg font-semibold text-slate-200 mt-1">{plan.property?.address || 'Address pending'}</h3>
                  <div className="mt-4 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Price:</span>
                      <span className="text-slate-200 font-medium">{currSymbol}{Number(plan.totalAmount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Paid:</span>
                      <span className="text-green-400 font-medium">{currSymbol}{Number(plan.totalPaid).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Balance:</span>
                      <span className="text-brand-accent font-medium">{currSymbol}{Number(plan.balanceRemaining).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setSelectedPlanForLedger(plan)}
                    className="mt-6 w-full bg-slate-800 hover:bg-brand-primary hover:text-white text-slate-200 py-2 rounded-xl transition-all text-sm font-medium border border-slate-700 hover:border-brand-primary"
                  >
                    View Ledger & Pay
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My Applications Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-slate-200 mb-4">My Applications</h2>
        {isLoadingInterests ? (
          <div className="text-slate-400">Loading applications...</div>
        ) : interests?.length === 0 ? (
          <div className="text-slate-500 bg-slate-900/30 p-6 rounded-2xl border border-slate-800">You haven't submitted any applications yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {interests?.map((interest: any) => {
              const propCurr = interest.property?.currency === 'USD' ? '$' : interest.property?.currency === 'EUR' ? '€' : interest.property?.currency === 'GHS' ? '₵' : '$';
              return (
                <div key={interest.id} className="glass-panel p-5 rounded-2xl border border-slate-700/50 flex flex-col">
                  {interest.property?.type && (
                    <div className="text-xs font-semibold text-brand-primary uppercase tracking-wider mb-1">{interest.property.type}</div>
                  )}
                  <h3 className="text-lg font-semibold text-slate-200">{interest.property?.address || 'Address pending'}</h3>
                  <div className="text-sm font-bold text-brand-secondary mt-1">
                    {propCurr}{Number(interest.property?.basePrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="text-slate-400">Status: </span>
                    <span className={`font-semibold ${
                      interest.status === 'APPROVED' ? 'text-green-400' :
                      interest.status === 'REJECTED' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {interest.status}
                    </span>
                  </div>
                
                {interest.status === 'APPROVED' && (
                  <button 
                    onClick={() => setSelectedApprovedInterest(interest)}
                    className="mt-4 w-full bg-brand-primary hover:bg-brand-primary/90 text-white py-2 rounded-xl transition-colors text-sm font-medium"
                  >
                    Setup Payment Plan
                  </button>
                )}

                {(interest.status === 'PENDING' || interest.status === 'APPROVED') && (
                  <button 
                    onClick={() => {
                      if (window.confirm('Are you sure you want to cancel this application?')) {
                        cancelInterestMutation.mutate(interest.id);
                      }
                    }}
                    disabled={cancelInterestMutation.isPending}
                    className="mt-2 w-full bg-slate-800 hover:bg-red-600/20 hover:text-red-400 text-slate-300 py-2 rounded-xl transition-colors text-sm font-medium border border-transparent hover:border-red-900"
                  >
                    Cancel Application
                  </button>
                )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Properties Section */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-200 mb-4">Available Properties</h2>
        {isLoading ? (
          <div className="text-slate-400">Loading available properties...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties?.length === 0 && (
              <div className="text-slate-400 col-span-full">No properties are currently available. Check back later!</div>
            )}
            {properties?.map((property: any) => (
              <div key={property.id} className="glass-panel p-6 rounded-2xl border border-slate-700/50 hover:border-brand-primary/50 transition-all">
                {property.images && property.images.length > 0 ? (
                  <div className="h-40 bg-slate-800 rounded-xl mb-4 overflow-hidden">
                    <img src={property.images[0]} alt="Property" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-40 bg-slate-800 rounded-xl mb-4 flex items-center justify-center text-slate-500">
                    No Images Available
                  </div>
                )}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded border ${property.status === 'AVAILABLE' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-700/50 text-slate-300 border-slate-600'}`}>
                      {property.status}
                    </span>
                    {Number(property.basePrice) >= 1000000 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-blue-500/20 text-blue-300 border-blue-500/30">
                        Milestone Part Payments
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-brand-secondary">
                    {property.currency === 'USD' ? '$' : property.currency === 'EUR' ? '€' : property.currency === 'GHS' ? '₵' : '$'}{Number(property.basePrice).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                </div>
                {property.type && (
                  <div className="text-xs font-medium text-brand-primary mb-1 uppercase tracking-wider">{property.type}</div>
                )}
                <h3 className="font-medium text-lg text-slate-100 mb-2">{property.address || 'Address pending'}</h3>
                <p className="text-slate-400 text-sm mb-4 line-clamp-2">{property.description || 'No description available.'}</p>
                
                {(() => {
                  const activeInterest = interests?.find((i: any) => i.propertyId === property.id && ['PENDING', 'APPROVED'].includes(i.status));
                  if (activeInterest) {
                    return (
                      <button 
                        disabled
                        className="w-full mt-4 bg-slate-800/50 text-slate-400 py-2 rounded-xl cursor-not-allowed text-sm font-medium"
                      >
                        {activeInterest.status === 'APPROVED' ? 'Application Approved' : 'Application Pending'}
                      </button>
                    );
                  }
                  return (
                    <button 
                      onClick={() => {
                        setSelectedProperty(property);
                        setShowApplicationTypeModal(true);
                      }}
                      className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-xl transition-colors text-sm font-medium"
                    >
                      Show Interest (Apply)
                    </button>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application Type Selection Modal */}
      {showApplicationTypeModal && !selectedApplicationType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-surface border border-slate-700/50 p-8 rounded-3xl max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-semibold mb-2 text-slate-100">Application Type</h2>
            <p className="text-slate-400 text-sm mb-6">Select how you want to apply for {selectedProperty.address}</p>

            <div className="space-y-4 mb-8">
              <button 
                onClick={() => setSelectedApplicationType('RENT_TO_OWN')}
                className="w-full p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:border-brand-primary/50 text-left transition-all group"
              >
                <span className="block text-slate-200 font-medium group-hover:text-brand-primary">Rent to Own</span>
                <span className="block text-slate-400 text-xs mt-1">Detailed application for our Rent-to-Own program.</span>
              </button>

              <button 
                onClick={() => setSelectedApplicationType('PAY_TO_OWN')}
                className="w-full p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 hover:border-brand-accent/50 text-left transition-all group"
              >
                <span className="block text-slate-200 font-medium group-hover:text-brand-accent">Pay to Own</span>
                <span className="block text-slate-400 text-xs mt-1">Standard application for Pay-to-Own.</span>
              </button>
            </div>

            <button 
              onClick={() => {
                setShowApplicationTypeModal(false);
                setSelectedProperty(null);
              }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Application Form Modal */}
      {selectedProperty && selectedApplicationType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-brand-surface border border-slate-700/50 p-8 rounded-3xl w-full max-w-4xl shadow-2xl my-8">
            <h2 className="text-xl font-semibold mb-2 text-slate-100">
              {selectedApplicationType === 'RENT_TO_OWN' ? 'Rent-To-Own Application' : 'Application Form'}
            </h2>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <p className="text-slate-400 text-sm">Applying for <span className="text-slate-200 font-medium">{selectedProperty.address}</span></p>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Total Property Price</span>
                <span className="text-lg font-bold text-brand-secondary">
                  {selectedProperty.currency === 'USD' ? '$' : selectedProperty.currency === 'EUR' ? '€' : selectedProperty.currency === 'GHS' ? '₵' : '$'}
                  {Number(selectedProperty.basePrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* High-Value Property Banner if >= $1M */}
            {Number(selectedProperty.basePrice) >= 1000000 && (
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-slate-900 border border-blue-500/30 text-blue-200 text-xs flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span className="font-semibold text-blue-300 text-sm block mb-0.5">High-Value Property Payment Architecture</span>
                  <p className="text-slate-300 leading-relaxed">
                    Stripe limits single online credit card transactions to $999,999.99. You can choose structured <strong className="text-white">Milestone Part-Payments</strong> or make a full purchase via <strong className="text-white">Equal Split Tranches</strong> or <strong className="text-white">Direct Bank Wire</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Purchase Mode Selector Tabs */}
            <div className="bg-slate-900/60 p-1.5 rounded-2xl border border-slate-700/60 flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setPurchaseMode('MILESTONE')}
                className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  purchaseMode === 'MILESTONE'
                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🏗️ Milestone Part-Payments</span>
              </button>
              <button
                type="button"
                onClick={() => setPurchaseMode('FULL')}
                className={`flex-1 py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  purchaseMode === 'FULL'
                    ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>💎 Full Purchase Options</span>
              </button>
            </div>

            {/* Mode 1: Milestone Part-Payments */}
            {purchaseMode === 'MILESTONE' && (() => {
              const totalPrice = Number(selectedProperty.basePrice);
              const candidatePcts = [10, 15, 20, 25, 30, 50];
              const safePcts = candidatePcts.filter(pct => (totalPrice * (pct / 100)) <= 999999.99);
              const activePcts = safePcts.length > 0 ? safePcts : [Math.max(1, Math.floor((950000 / totalPrice) * 100))];

              // Ensure initialDepositPercentage is valid in current set
              if (!activePcts.includes(initialDepositPercentage)) {
                setInitialDepositPercentage(activePcts[activePcts.length - 1]);
              }

              const currentDepositAmt = totalPrice * (initialDepositPercentage / 100);
              const currSymbol = selectedProperty.currency === 'USD' ? '$' : selectedProperty.currency === 'EUR' ? '€' : selectedProperty.currency === 'GHS' ? '₵' : '$';

              return (
                <div className="bg-slate-900/50 border border-slate-700/50 p-5 rounded-2xl mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">Select Initial Milestone Deposit</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Project commencement begins upon payment of this deposit.</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      Stripe Online Approved (≤ $999k)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {activePcts.map((pct) => {
                      const amount = totalPrice * (pct / 100);
                      const isSelected = initialDepositPercentage === pct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setInitialDepositPercentage(pct)}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-brand-primary/20 border-brand-primary text-white shadow-lg shadow-brand-primary/10'
                              : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <div className="font-bold text-sm">{pct}% Deposit</div>
                          <div className="text-xs text-slate-300 mt-1 font-mono font-medium">
                            {currSymbol}{amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Real Estate Milestone Roadmap Preview */}
                  <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
                    <span className="font-semibold text-slate-300 block mb-2">Structured Milestone Schedule:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-400">
                      <div className="p-2.5 rounded-lg bg-brand-primary/10 border border-brand-primary/30">
                        <span className="text-brand-primary font-bold block mb-0.5">Milestone 1 (Now)</span>
                        <span className="text-slate-200 font-medium">{currSymbol}{currentDepositAmt.toLocaleString()}</span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">Initial Allocation & Signing</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 font-bold block mb-0.5">Milestone 2</span>
                        <span className="text-slate-300 font-medium">Structured Tranche</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">Substructure & Superstructure</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-slate-400 font-bold block mb-0.5">Milestone 3</span>
                        <span className="text-slate-300 font-medium">Final Balance</span>
                        <span className="block text-[11px] text-slate-500 mt-0.5">Roofing, Finishing & Keys</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Mode 2: Full Purchase Options */}
            {purchaseMode === 'FULL' && (() => {
              const totalPrice = Number(selectedProperty.basePrice);
              const currSymbol = selectedProperty.currency === 'USD' ? '$' : selectedProperty.currency === 'EUR' ? '€' : selectedProperty.currency === 'GHS' ? '₵' : '$';
              const isHigh = totalPrice >= 1000000;
              const fullTranches = Math.max(2, Math.ceil(totalPrice / 900000));
              const trancheAmt = Math.round((totalPrice / fullTranches) * 100) / 100;

              return (
                <div className="bg-slate-900/50 border border-slate-700/50 p-5 rounded-2xl mb-6">
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Choose Full Purchase Payment Method</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    {isHigh 
                      ? `Since property exceeds $1M, choose between equal online Stripe tranches or direct Bank Wire.`
                      : `Select how you would like to complete your full payment.`}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Option 1: Tranches or Single Stripe */}
                    <div
                      onClick={() => setFullPaymentChoice('TRANCHES')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        fullPaymentChoice === 'TRANCHES'
                          ? 'bg-brand-primary/20 border-brand-primary text-white shadow-lg'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">💳</span>
                        <span className="font-semibold text-sm">
                          {isHigh ? `Multi-Tranche Stripe (${fullTranches} Parts)` : `Stripe Online Payment`}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 leading-relaxed">
                        {isHigh ? (
                          <>
                            Split into <strong className="text-white">{fullTranches} equal payments</strong> of <strong className="text-brand-secondary">{currSymbol}{trancheAmt.toLocaleString()}</strong> each. Tranche 1 payable now via Stripe.
                          </>
                        ) : (
                          <>Pay the full balance of <strong className="text-brand-secondary">{currSymbol}{totalPrice.toLocaleString()}</strong> immediately in a single secure Stripe transaction.</>
                        )}
                      </div>
                    </div>

                    {/* Option 2: Bank Wire */}
                    <div
                      onClick={() => setFullPaymentChoice('WIRE')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        fullPaymentChoice === 'WIRE'
                          ? 'bg-brand-primary/20 border-brand-primary text-white shadow-lg'
                          : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">🏛️</span>
                        <span className="font-semibold text-sm">Direct Bank Wire Transfer</span>
                      </div>
                      <div className="text-xs text-slate-400 leading-relaxed">
                        Instant corporate Wire Invoice for <strong className="text-amber-300">{currSymbol}{totalPrice.toLocaleString()}</strong> with SWIFT & routing details. Zero transaction limits or card fees.
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Application Forms with Updated Submissions */}
            {selectedApplicationType === 'RENT_TO_OWN' ? (
              <RentToOwnForm 
                onSubmit={(data) => {
                  const totalPrice = Number(selectedProperty.basePrice);
                  const isHigh = totalPrice >= 1000000;
                  const fullTranches = Math.max(2, Math.ceil(totalPrice / 900000));
                  const trancheAmt = Math.round((totalPrice / fullTranches) * 100) / 100;

                  if (purchaseMode === 'MILESTONE') {
                    const amount = totalPrice * (initialDepositPercentage / 100);
                    setPaymentSummary({
                      isOpen: true,
                      totalPrice,
                      paymentAmount: amount,
                      percentage: initialDepositPercentage,
                      isFullPayment: false,
                      paymentMethod: 'STRIPE',
                      currency: selectedProperty.currency || 'USD',
                      trancheInfo: `Milestone Initial Deposit (${initialDepositPercentage}%)`,
                      onProceed: () => submitInterestMutation.mutate({
                        ...data,
                        initialDepositPercentage,
                        paymentMethod: 'STRIPE',
                        isFullPayment: false
                      })
                    });
                  } else if (purchaseMode === 'FULL') {
                    if (fullPaymentChoice === 'WIRE') {
                      setPaymentSummary({
                        isOpen: true,
                        totalPrice,
                        paymentAmount: totalPrice,
                        percentage: 100,
                        isFullPayment: true,
                        paymentMethod: 'WIRE',
                        currency: selectedProperty.currency || 'USD',
                        trancheInfo: `Full Purchase via Bank Wire Transfer`,
                        onProceed: () => submitInterestMutation.mutate({
                          ...data,
                          paymentMethod: 'WIRE',
                          isFullPayment: true,
                          initialDepositPercentage: 100
                        })
                      });
                    } else {
                      const amount = isHigh ? trancheAmt : totalPrice;
                      setPaymentSummary({
                        isOpen: true,
                        totalPrice,
                        paymentAmount: amount,
                        percentage: isHigh ? Math.round(100 / fullTranches) : 100,
                        isFullPayment: true,
                        paymentMethod: 'STRIPE',
                        currency: selectedProperty.currency || 'USD',
                        trancheInfo: isHigh ? `Full Purchase (Tranche 1 of ${fullTranches})` : `Full 100% Purchase`,
                        onProceed: () => submitInterestMutation.mutate({
                          ...data,
                          paymentMethod: 'STRIPE',
                          isFullPayment: true,
                          trancheCount: isHigh ? fullTranches : 1,
                          trancheIndex: 1
                        })
                      });
                    }
                  }
                }}
                onCancel={() => {
                  setSelectedProperty(null);
                  setSelectedApplicationType(null);
                  setShowApplicationTypeModal(false);
                }}
                isSubmitting={submitInterestMutation.isPending}
              />
            ) : (
              <PayToOwnForm 
                onSubmit={(data) => {
                  const totalPrice = Number(selectedProperty.basePrice);
                  const isHigh = totalPrice >= 1000000;
                  const fullTranches = Math.max(2, Math.ceil(totalPrice / 900000));
                  const trancheAmt = Math.round((totalPrice / fullTranches) * 100) / 100;

                  if (purchaseMode === 'MILESTONE') {
                    const amount = totalPrice * (initialDepositPercentage / 100);
                    setPaymentSummary({
                      isOpen: true,
                      totalPrice,
                      paymentAmount: amount,
                      percentage: initialDepositPercentage,
                      isFullPayment: false,
                      paymentMethod: 'STRIPE',
                      currency: selectedProperty.currency || 'USD',
                      trancheInfo: `Milestone Initial Deposit (${initialDepositPercentage}%)`,
                      onProceed: () => submitInterestMutation.mutate({
                        ...data,
                        initialDepositPercentage,
                        paymentMethod: 'STRIPE',
                        isFullPayment: false
                      })
                    });
                  } else if (purchaseMode === 'FULL') {
                    if (fullPaymentChoice === 'WIRE') {
                      setPaymentSummary({
                        isOpen: true,
                        totalPrice,
                        paymentAmount: totalPrice,
                        percentage: 100,
                        isFullPayment: true,
                        paymentMethod: 'WIRE',
                        currency: selectedProperty.currency || 'USD',
                        trancheInfo: `Full Purchase via Bank Wire Transfer`,
                        onProceed: () => submitInterestMutation.mutate({
                          ...data,
                          paymentMethod: 'WIRE',
                          isFullPayment: true,
                          initialDepositPercentage: 100
                        })
                      });
                    } else {
                      const amount = isHigh ? trancheAmt : totalPrice;
                      setPaymentSummary({
                        isOpen: true,
                        totalPrice,
                        paymentAmount: amount,
                        percentage: isHigh ? Math.round(100 / fullTranches) : 100,
                        isFullPayment: true,
                        paymentMethod: 'STRIPE',
                        currency: selectedProperty.currency || 'USD',
                        trancheInfo: isHigh ? `Full Purchase (Tranche 1 of ${fullTranches})` : `Full 100% Purchase`,
                        onProceed: () => submitInterestMutation.mutate({
                          ...data,
                          paymentMethod: 'STRIPE',
                          isFullPayment: true,
                          trancheCount: isHigh ? fullTranches : 1,
                          trancheIndex: 1
                        })
                      });
                    }
                  }
                }}
                onCancel={() => {
                  setSelectedProperty(null);
                  setSelectedApplicationType(null);
                  setShowApplicationTypeModal(false);
                }}
                isSubmitting={submitInterestMutation.isPending}
              />
            )}
          </div>
        </div>
      )}

      {/* Payment Plan Setup Modal (for approved applications) */}
      {selectedApprovedInterest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-surface border border-slate-700/50 p-8 rounded-3xl max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-semibold mb-2 text-slate-100">Setup Payment Plan</h2>
            <p className="text-slate-400 text-sm mb-6">Choose how you want to pay for {selectedApprovedInterest.property.address}</p>

            <div className="space-y-4 mb-8">
              <label className="flex items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 cursor-pointer hover:border-brand-primary/50 transition-all">
                <input 
                  type="radio" 
                  name="planType" 
                  value="PAY_TO_OWN"
                  checked={planType === 'PAY_TO_OWN'}
                  onChange={(e) => setPlanType(e.target.value)}
                  className="text-brand-primary focus:ring-brand-primary bg-slate-800 border-slate-600"
                />
                <div className="ml-3">
                  <span className="block text-slate-200 font-medium">Pay to Own</span>
                  <span className="block text-slate-400 text-xs mt-0.5">Pay a 5% deposit today, clear the rest over time.</span>
                </div>
              </label>

              <label className="flex items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 cursor-pointer hover:border-brand-primary/50 transition-all">
                <input 
                  type="radio" 
                  name="planType" 
                  value="RENT_TO_OWN"
                  checked={planType === 'RENT_TO_OWN'}
                  onChange={(e) => setPlanType(e.target.value)}
                  className="text-brand-primary focus:ring-brand-primary bg-slate-800 border-slate-600"
                />
                <div className="ml-3">
                  <span className="block text-slate-200 font-medium">Rent to Own</span>
                  <span className="block text-slate-400 text-xs mt-0.5">Pay standard monthly rent, which builds equity.</span>
                </div>
              </label>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setSelectedApprovedInterest(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl transition-colors font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={() => createPlanMutation.mutate()}
                disabled={createPlanMutation.isPending}
                className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white py-3 rounded-xl transition-colors font-medium"
              >
                {createPlanMutation.isPending ? 'Processing...' : 'Start Plan & Pay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Ledger & Payment Modal */}
      {selectedPlanForLedger && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-brand-surface border border-slate-700/50 p-8 rounded-3xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-semibold mb-1 text-slate-100">Plan Details & Ledger</h2>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-800">
              <div>
                {selectedPlanForLedger.property?.type && (
                  <span className="text-xs text-brand-primary font-semibold uppercase tracking-wider block">{selectedPlanForLedger.property.type}</span>
                )}
                <p className="text-slate-300 font-medium text-sm">{selectedPlanForLedger.property?.address || 'Address pending'}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block">Total Plan Price</span>
                <span className="text-lg font-bold text-brand-secondary">
                  {selectedPlanForLedger.currency === 'USD' ? '$' : selectedPlanForLedger.currency === 'EUR' ? '€' : selectedPlanForLedger.currency === 'GHS' ? '₵' : '$'}
                  {Number(selectedPlanForLedger.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 mb-8">
              <h3 className="text-lg font-medium text-slate-200 mb-4">Make a Payment</h3>
              <div className="flex gap-4">
                <input 
                  type="number" 
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Amount in USD"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 text-slate-200 focus:outline-none focus:border-brand-primary"
                />
                <button 
                  onClick={() => {
                    if (Number(paymentAmount) > 0) {
                      const amount = Number(paymentAmount);
                      const totalPrice = Number(selectedPlanForLedger.totalAmount);
                      const percentage = (amount / totalPrice) * 100;
                      
                      setPaymentSummary({
                        isOpen: true,
                        totalPrice,
                        paymentAmount: amount,
                        percentage,
                        currency: selectedPlanForLedger.currency || 'USD',
                        onProceed: () => customPaymentMutation.mutate(amount)
                      });
                    } else {
                      showToast("Invalid Amount", "Please enter a valid amount greater than 0.", "warning");
                    }
                  }}
                  disabled={customPaymentMutation.isPending || !paymentAmount}
                  className="bg-brand-primary hover:bg-brand-primary/90 text-white px-6 py-3 rounded-xl transition-colors font-medium disabled:opacity-50"
                >
                  {customPaymentMutation.isPending ? 'Processing...' : 'Pay Now'}
                </button>
              </div>
            </div>

            <h3 className="text-lg font-medium text-slate-200 mb-4">Transaction History</h3>
            {selectedPlanForLedger.ledgerEntries?.length === 0 ? (
              <p className="text-slate-500">No transactions yet.</p>
            ) : (
              <div className="space-y-3">
                {selectedPlanForLedger.ledgerEntries?.map((entry: any) => (
                  <div key={entry.id} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <div>
                      <span className="block text-slate-200 font-medium">{entry.type.replace('_', ' ')}</span>
                      <span className="block text-slate-400 text-xs mt-1">{new Date(entry.transactionDate).toLocaleString()}</span>
                    </div>
                    <span className={`font-semibold ${Number(entry.amountGHS) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Number(entry.amountGHS) > 0 ? '+' : ''}${Number(entry.amountGHS).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button 
              onClick={() => {
                setSelectedPlanForLedger(null);
                setPaymentAmount('');
              }}
              className="w-full mt-8 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Payment Summary Modal */}
      {paymentSummary?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="bg-brand-surface border border-slate-700/50 p-8 rounded-3xl w-full max-w-md shadow-2xl my-8">
            <h2 className="text-xl font-semibold mb-6 text-slate-100 text-center">Payment Summary</h2>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                <span className="text-slate-400">Total Property Price</span>
                <span className="text-slate-200 font-medium">
                  {paymentSummary.currency === 'USD' ? '$' : paymentSummary.currency === 'EUR' ? '€' : paymentSummary.currency === 'GHS' ? '₵' : '$'}
                  {paymentSummary.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                <span className="text-slate-400">Payment Breakdown</span>
                <span className="text-brand-primary font-medium text-right text-xs">
                  {paymentSummary.trancheInfo || `${paymentSummary.percentage?.toFixed(1)}% Deposit`}
                </span>
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                <span className="text-slate-400">Method</span>
                <span className="text-slate-300 font-medium text-xs flex items-center gap-1.5">
                  {paymentSummary.paymentMethod === 'WIRE' ? '🏛️ Bank Wire Transfer' : '💳 Stripe Checkout'}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-slate-900/80 rounded-xl border border-brand-primary/50">
                <span className="text-slate-200 font-medium">Amount to Pay</span>
                <span className="text-xl font-bold text-white">
                  {paymentSummary.currency === 'USD' ? '$' : paymentSummary.currency === 'EUR' ? '€' : paymentSummary.currency === 'GHS' ? '₵' : '$'}
                  {paymentSummary.paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {paymentModalError && (
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-rose-950/90 via-slate-900 to-slate-900 border border-rose-500/50 shadow-xl shadow-rose-950/30 text-rose-200 text-xs flex items-start gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-rose-300 text-sm mb-0.5">Payment Notice</div>
                  <div className="text-slate-300 leading-relaxed break-words">{paymentModalError}</div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setPaymentModalError(null)}
                  className="text-slate-400 hover:text-slate-200 transition p-1"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={() => setPaymentSummary(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl transition-colors font-medium"
                disabled={submitInterestMutation.isPending || customPaymentMutation.isPending}
              >
                Cancel
              </button>
              <button 
                onClick={paymentSummary.onProceed}
                disabled={submitInterestMutation.isPending || customPaymentMutation.isPending}
                className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white py-3 rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
              >
                {submitInterestMutation.isPending || customPaymentMutation.isPending 
                  ? 'Processing...' 
                  : paymentSummary.paymentMethod === 'WIRE' 
                    ? 'Generate Wire Invoice' 
                    : 'Proceed to Stripe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wire Transfer Details Modal */}
      {wireTransferDetails && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[70] overflow-y-auto">
          <div className="bg-brand-surface border border-slate-700/70 p-8 rounded-3xl w-full max-w-lg shadow-2xl my-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-100">Bank Wire Instructions</h2>
                  <p className="text-xs text-slate-400">Official invoice generated for your property purchase</p>
                </div>
              </div>
              <button
                onClick={() => setWireTransferDetails(null)}
                className="text-slate-400 hover:text-slate-200 transition p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-900 border border-amber-500/30 p-4 rounded-2xl mb-6">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Wire Amount</span>
                <span className="text-xl font-extrabold text-amber-300">
                  {wireTransferDetails.currency === 'USD' ? '$' : wireTransferDetails.currency === 'EUR' ? '€' : wireTransferDetails.currency === 'GHS' ? '₵' : '$'}
                  {Number(wireTransferDetails.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Wire Reference Code:</span>
                <span className="font-mono font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded">{wireTransferDetails.reference}</span>
              </div>
            </div>

            <div className="space-y-3 bg-slate-900/60 p-5 rounded-2xl border border-slate-700/60 text-sm mb-6">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400 text-xs">Beneficiary Bank:</span>
                <span className="text-slate-200 font-medium text-right text-xs">{wireTransferDetails.bankName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400 text-xs">Account Name:</span>
                <span className="text-slate-200 font-medium text-right text-xs">{wireTransferDetails.accountName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400 text-xs">Account Number / IBAN:</span>
                <span className="text-slate-100 font-mono font-bold text-right text-xs">{wireTransferDetails.accountNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400 text-xs">SWIFT / BIC:</span>
                <span className="text-slate-100 font-mono font-bold text-right text-xs">{wireTransferDetails.swiftCode}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 text-xs">Routing / Sort Code:</span>
                <span className="text-slate-100 font-mono text-right text-xs">{wireTransferDetails.routingNumber}</span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed mb-6">
              <span className="font-semibold text-amber-300 block mb-1">Important Narration Note:</span>
              {wireTransferDetails.instructions}
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const wireText = `Cereno Homes - Wire Transfer Details\nReference: ${wireTransferDetails.reference}\nAmount: ${wireTransferDetails.currency} ${Number(wireTransferDetails.amount).toLocaleString()}\nBank: ${wireTransferDetails.bankName}\nAccount Name: ${wireTransferDetails.accountName}\nAccount Number: ${wireTransferDetails.accountNumber}\nSWIFT: ${wireTransferDetails.swiftCode}\nRouting: ${wireTransferDetails.routingNumber}`;
                  await navigator.clipboard.writeText(wireText);
                  setCopiedWireDetails(true);
                  setTimeout(() => setCopiedWireDetails(false), 3000);
                  showToast("Copied to Clipboard", "Bank wire instructions copied successfully.", "success");
                }}
                className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 py-3 rounded-xl transition-colors font-medium flex items-center justify-center gap-2"
              >
                {copiedWireDetails ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Details Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copy Wire Details
                  </>
                )}
              </button>
              <button
                onClick={() => setWireTransferDetails(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-xl transition-colors font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ClientDashboard;
