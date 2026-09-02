import axios from 'axios';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_placeholder';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const paystackApi = axios.create({
  baseURL: PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

export const initializePayment = async (
  email: string,
  amountGHS: number,
  currency: string = 'GHS',
  reference: string,
  callbackUrl?: string,
  metadata?: any
) => {
  try {
    const response = await paystackApi.post('/transaction/initialize', {
      email,
      amount: Math.round(amountGHS * 100), // Paystack expects amount in kobo/pesewas (smallest currency unit)
      currency,
      reference,
      channels: ['card', 'mobile_money'],
      callback_url: callbackUrl,
      metadata,
    });

    return response.data.data;
  } catch (error: any) {
    console.error('Error initializing Paystack payment:', error.response?.data || error.message);
    throw new Error('Failed to initialize payment');
  }
};

export const verifyPayment = async (reference: string) => {
  try {
    const response = await paystackApi.get(`/transaction/verify/${reference}`);
    return response.data.data;
  } catch (error: any) {
    console.error('Error verifying Paystack payment:', error.response?.data || error.message);
    throw new Error('Failed to verify payment');
  }
};
