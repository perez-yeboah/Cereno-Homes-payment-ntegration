import React, { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { initializePayment, fetchSavedCards, chargeSavedCard } from '../services/api';

const paymentSchema = z.object({
  paymentPlanId: z.string().min(1, { message: "Payment Plan ID is required" }),
  amount: z.number().min(1, { message: "Amount must be greater than 0" })
});

type PaymentForm = z.infer<typeof paymentSchema>;

const ClientPortal: React.FC = () => {
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentPlanId: 'demo-plan-id',
      amount: 5000
    }
  });

  const paymentPlanId = useWatch({ control, name: 'paymentPlanId' });

  useEffect(() => {
    if (paymentPlanId && paymentPlanId.length > 5) {
      const loadCards = async () => {
        try {
          const cards = await fetchSavedCards(paymentPlanId);
          setSavedCards(cards || []);
          if (cards && cards.length > 0) {
            setSelectedCardId(cards[0].id);
          } else {
            setSelectedCardId(null);
          }
        } catch (e) {
          setSavedCards([]);
        }
      };
      const timeout = setTimeout(loadCards, 500); // debounce
      return () => clearTimeout(timeout);
    }
  }, [paymentPlanId]);

  const onSubmit = async (data: PaymentForm) => {
    setApiError(null);
    setSuccessMsg(null);
    try {
      if (selectedCardId) {
        // Use saved card flow
        const result = await chargeSavedCard({
          paymentPlanId: data.paymentPlanId,
          amount: data.amount,
          currency: 'GHS',
          savedCardId: selectedCardId
        });
        setSuccessMsg(`Payment charged successfully! Reference: ${result.reference}`);
      } else {
        // Fallback to normal flow
        const result = await initializePayment({ ...data, currency: 'GHS', channel: ['card', 'mobile_money'], callbackUrl: `${window.location.origin}/payment/verify` });
        window.location.href = result.authorization_url;
      }
    } catch (error: any) {
      console.error('Payment failed to initialize', error);
      setApiError(error.response?.data?.error || 'Failed to process payment. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-slate-900 via-brand-dark to-black flex items-center justify-center p-8">
      <div className="glass-panel max-w-md w-full p-8 rounded-3xl animate-fade-in shadow-2xl shadow-brand-primary/10">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-light text-slate-100 tracking-wide">
            Cereno<span className="font-semibold text-brand-primary">Homes</span>
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Client Payment Portal</p>
        </div>

        {apiError && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-200 text-sm">
            {apiError}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-500/50 rounded-xl text-green-200 text-sm">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Payment Plan ID</label>
            <input 
              {...register('paymentPlanId')}
              type="text" 
              className={`w-full bg-slate-900/50 border ${errors.paymentPlanId ? 'border-red-500' : 'border-slate-700/50'} rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all`}
              placeholder="Enter your plan ID"
            />
            {errors.paymentPlanId && <p className="text-red-400 text-xs mt-1">{errors.paymentPlanId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Amount to Pay (GHS)</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-slate-500 font-medium">₵</span>
              <input 
                {...register('amount', { valueAsNumber: true })}
                type="number" 
                className={`w-full bg-slate-900/50 border ${errors.amount ? 'border-red-500' : 'border-slate-700/50'} rounded-xl pl-9 pr-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all`}
              />
            </div>
            {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          {savedCards.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Payment Method</label>
              <div className="space-y-2">
                {savedCards.map(card => (
                  <label key={card.id} className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${selectedCardId === card.id ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-700/50 bg-slate-800/30'}`}>
                    <input 
                      type="radio" 
                      name="payment_method" 
                      checked={selectedCardId === card.id}
                      onChange={() => setSelectedCardId(card.id)}
                      className="text-brand-primary focus:ring-brand-primary h-4 w-4 bg-slate-900 border-slate-700"
                    />
                    <div className="ml-3 flex flex-col">
                      <span className="text-sm font-medium text-slate-200">{card.bank} {card.cardType} ending in {card.last4}</span>
                      <span className="text-xs text-slate-400">Expires {card.expMonth}/{card.expYear}</span>
                    </div>
                  </label>
                ))}
                <label className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${selectedCardId === null ? 'border-brand-primary bg-brand-primary/10' : 'border-slate-700/50 bg-slate-800/30'}`}>
                  <input 
                    type="radio" 
                    name="payment_method" 
                    checked={selectedCardId === null}
                    onChange={() => setSelectedCardId(null)}
                    className="text-brand-primary focus:ring-brand-primary h-4 w-4 bg-slate-900 border-slate-700"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-200">New Payment Method</span>
                </label>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-brand-primary to-brand-accent hover:from-brand-primary/90 hover:to-brand-accent/90 text-white font-medium rounded-xl px-4 py-3.5 shadow-lg shadow-brand-primary/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center"
          >
            {isSubmitting ? (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (selectedCardId ? 'Pay Now' : 'Pay with Mobile Money or Card')}
          </button>
        </form>
        
        <div className="mt-8 flex items-center justify-center space-x-4 opacity-50">
          <div className="text-xs font-semibold tracking-wider uppercase text-slate-400">Secured by Paystack</div>
        </div>
      </div>
    </div>
  );
};

export default ClientPortal;
