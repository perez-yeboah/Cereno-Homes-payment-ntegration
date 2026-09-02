import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { verifyPayment } from '../services/api';

const PaymentVerify: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');

  const reference = searchParams.get('reference') || searchParams.get('trxref');

  useEffect(() => {
    if (!reference) {
      setStatus('error');
      setMessage('No payment reference found.');
      return;
    }

    const verify = async () => {
      try {
        await verifyPayment(reference);
        setStatus('success');
        setMessage('Payment successful! Your transaction has been recorded.');
        
        // Auto-redirect back to dashboard after 3 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } catch (error) {
        console.error('Payment verification failed:', error);
        setStatus('error');
        setMessage('Payment verification failed. Please contact support if you have been debited.');
      }
    };

    verify();
  }, [reference, navigate]);

  return (
    <div className="min-h-screen bg-brand-dark bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-slate-900 via-brand-dark to-black flex items-center justify-center p-8">
      <div className="glass-panel max-w-md w-full p-8 rounded-3xl animate-fade-in shadow-2xl shadow-brand-primary/10 text-center flex flex-col items-center">
        {status === 'verifying' && (
          <>
            <div className="w-12 h-12 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin mb-4"></div>
            <h2 className="text-xl font-semibold text-slate-200">Verifying Payment</h2>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-4 border border-green-500/30">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-200 mb-2">Payment Successful!</h2>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-200 mb-2">Verification Failed</h2>
          </>
        )}

        <p className="text-slate-400 mt-2">{message}</p>
        
        {status !== 'verifying' && (
          <Link to="/dashboard" className="mt-8 btn-primary w-full text-center py-3">
            Return to Dashboard
          </Link>
        )}
      </div>
    </div>
  );
};

export default PaymentVerify;
