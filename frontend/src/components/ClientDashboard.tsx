import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { initializePayment, cancelClientApplication, fetchClientPlans } from '../services/api';
import RentToOwnForm from './forms/RentToOwnForm';
import PayToOwnForm from './forms/PayToOwnForm';

const fetchProperties = async () => {
  const { data } = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/client/properties`);
  return data;
};

const fetchInterests = async (token: string | null) => {
  if (!token) return [];
  const { data } = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/client/interests`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

const ClientDashboard: React.FC = () => {
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [showApplicationTypeModal, setShowApplicationTypeModal] = useState(false);
  const [selectedApplicationType, setSelectedApplicationType] = useState<string | null>(null);
  const [selectedApprovedInterest, setSelectedApprovedInterest] = useState<any>(null);
  const [selectedPlanForLedger, setSelectedPlanForLedger] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  
  const [planType, setPlanType] = useState('PAY_TO_OWN');
  
  // Application Form State
  const [formData, setFormData] = useState({
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
      const result = await initializePayment({
        paymentPlanId: selectedPlanForLedger.id,
        amount,
        currency: 'GHS',
        channel: ['card', 'mobile_money'],
        callbackUrl: `${window.location.origin}/payment/verify`
      });
      return result;
    },
    onSuccess: (result) => {
      window.location.href = result.authorization_url;
    },
    onError: (error: any) => {
      alert("Failed to initialize payment.");
    }
  });

  const submitInterestMutation = useMutation({
    mutationFn: async (payload: any = formData) => {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/client/interests`, 
        { propertyId: selectedProperty.id, submittedData: payload },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myInterests'] });
      setSelectedProperty(null);
      setShowApplicationTypeModal(false);
      setSelectedApplicationType(null);
      setFormData({ employmentStatus: '', monthlyIncome: '', comments: '' });
      alert("Application submitted successfully! Please wait for admin approval.");
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || "Failed to submit application");
    }
  });

  const createPlanMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/client/plans`, 
        { propertyId: selectedApprovedInterest.propertyId, type: planType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    onSuccess: async (data) => {
      try {
        const result = await initializePayment({
          paymentPlanId: data.plan.id,
          amount: Number(data.invoice.amountDue),
          currency: 'GHS',
          channel: ['card', 'mobile_money'],
          callbackUrl: `${window.location.origin}/payment/verify`
        });
        window.location.href = result.authorization_url;
      } catch (error) {
        alert("Plan created, but failed to initialize payment. Please contact support.");
      }
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || "Failed to create plan");
    }
  });

  const cancelInterestMutation = useMutation({
    mutationFn: async (id: string) => {
      return cancelClientApplication(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myInterests'] });
      alert("Application cancelled successfully.");
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || "Failed to cancel application");
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
            {plans?.map((plan: any) => (
              <div key={plan.id} className="glass-panel p-5 rounded-2xl border border-brand-primary/30 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 text-xs font-bold bg-brand-primary text-white rounded-bl-xl">{plan.type}</div>
                <h3 className="text-lg font-semibold text-slate-200 mt-2">{plan.property?.address}</h3>
                <div className="mt-4 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Price:</span>
                    <span className="text-slate-200 font-medium">₵{Number(plan.totalAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Paid:</span>
                    <span className="text-green-400 font-medium">₵{Number(plan.totalPaid).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Balance:</span>
                    <span className="text-brand-accent font-medium">₵{Number(plan.balanceRemaining).toLocaleString()}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setSelectedPlanForLedger(plan)}
                  className="mt-6 w-full bg-slate-800 hover:bg-brand-primary hover:text-white text-slate-200 py-2 rounded-xl transition-all text-sm font-medium border border-slate-700 hover:border-brand-primary"
                >
                  View Ledger & Pay
                </button>
              </div>
            ))}
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
            {interests?.map((interest: any) => (
              <div key={interest.id} className="glass-panel p-5 rounded-2xl border border-slate-700/50 flex flex-col">
                <h3 className="text-lg font-semibold text-slate-200">{interest.property.address}</h3>
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
            ))}
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
                <div className="h-40 bg-slate-800 rounded-xl mb-4 flex items-center justify-center text-slate-500">
                  [Property Image]
                </div>
                <h3 className="text-lg font-semibold text-slate-200">{property.address}</h3>
                <p className="text-brand-accent font-medium mt-1">₵{Number(property.basePrice).toLocaleString()}</p>
                
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
            <p className="text-slate-400 text-sm mb-6">Applying for {selectedProperty.address}</p>

            {selectedApplicationType === 'RENT_TO_OWN' ? (
              <RentToOwnForm 
                onSubmit={(data) => submitInterestMutation.mutate(data)}
                onCancel={() => {
                  setSelectedProperty(null);
                  setSelectedApplicationType(null);
                  setShowApplicationTypeModal(false);
                }}
                isSubmitting={submitInterestMutation.isPending}
              />
            ) : (
              <PayToOwnForm 
                onSubmit={(data) => submitInterestMutation.mutate(data)}
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
            <h2 className="text-2xl font-semibold mb-2 text-slate-100">Plan Details & Ledger</h2>
            <p className="text-slate-400 text-sm mb-6">{selectedPlanForLedger.property?.address}</p>

            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 mb-8">
              <h3 className="text-lg font-medium text-slate-200 mb-4">Make a Payment</h3>
              <div className="flex gap-4">
                <input 
                  type="number" 
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Amount in GHS"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 text-slate-200 focus:outline-none focus:border-brand-primary"
                />
                <button 
                  onClick={() => {
                    if (Number(paymentAmount) > 0) {
                      customPaymentMutation.mutate(Number(paymentAmount));
                    } else {
                      alert("Please enter a valid amount");
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
                      {Number(entry.amountGHS) > 0 ? '+' : ''}{Number(entry.amountGHS).toLocaleString()} GHS
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
    </div>
  );
};

export default ClientDashboard;
