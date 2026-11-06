import Stripe from 'stripe';
import { IPaymentProvider } from '../interfaces/IPaymentProvider';

export class StripeService implements IPaymentProvider {
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder';
    this.stripe = new Stripe(secretKey);
  }

  async initializePayment(
    email: string,
    amount: number,
    currency: string = 'USD',
    reference: string,
    callbackUrl?: string,
    metadata?: any
  ) {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const successUrl = callbackUrl 
        ? `${callbackUrl}${callbackUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}&reference=${encodeURIComponent(reference)}`
        : `${frontendUrl}/payment/verify?session_id={CHECKOUT_SESSION_ID}&reference=${encodeURIComponent(reference)}`;
      
      const cancelUrl = `${frontendUrl}/dashboard?payment_canceled=true`;

      // Stripe expects amount in the smallest currency unit (e.g. cents for USD/EUR, pesewas for GHS)
      const unitAmount = Math.round(amount * 100);

      // Supported Stripe currencies are lowercase 3-letter ISO codes
      const stripeCurrency = (currency || 'USD').toLowerCase();

      // Get or create Stripe Customer so payment method can be saved for future off-session charges
      let customerId: string | undefined;
      try {
        const existingCustomers = await this.stripe.customers.list({
          email,
          limit: 1,
        });
        if (existingCustomers.data.length > 0) {
          customerId = existingCustomers.data[0].id;
        } else {
          const customer = await this.stripe.customers.create({
            email,
            metadata: {
              reference,
              paymentPlanId: metadata?.paymentPlanId ? String(metadata.paymentPlanId) : '',
            },
          });
          customerId = customer.id;
        }
      } catch (custErr) {
        console.warn('Could not retrieve or create Stripe customer:', custErr);
      }

      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        ...(customerId
          ? { customer: customerId }
          : { customer_email: email, customer_creation: 'always' }),
        client_reference_id: reference,
        line_items: [
          {
            price_data: {
              currency: stripeCurrency,
              unit_amount: unitAmount,
              product_data: {
                name: metadata?.description || `Cereno Homes - Property Payment`,
                description: `Transaction Reference: ${reference}`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          reference,
          paymentPlanId: metadata?.paymentPlanId ? String(metadata.paymentPlanId) : '',
          propertyInterestId: metadata?.propertyInterestId ? String(metadata.propertyInterestId) : '',
          originalCurrency: currency.toUpperCase(),
          originalAmount: String(amount),
        },
        payment_intent_data: {
          setup_future_usage: 'off_session',
          metadata: {
            reference,
            paymentPlanId: metadata?.paymentPlanId ? String(metadata.paymentPlanId) : '',
            propertyInterestId: metadata?.propertyInterestId ? String(metadata.propertyInterestId) : '',
          },
        },
      });

      return {
        authorization_url: session.url,
        checkoutUrl: session.url,
        sessionId: session.id,
        reference: reference,
        access_code: session.id,
      };
    } catch (error: any) {
      console.error('Error initializing Stripe Checkout session:', error);
      throw new Error(error.message || 'Failed to initialize Stripe payment');
    }
  }

  async verifyPayment(referenceOrSessionId: string) {
    try {
      let session: Stripe.Checkout.Session | null = null;

      if (referenceOrSessionId.startsWith('cs_')) {
        // Direct checkout session ID
        session = await this.stripe.checkout.sessions.retrieve(referenceOrSessionId, {
          expand: ['payment_intent', 'payment_intent.payment_method'],
        });
      } else {
        // Search sessions or check payment intents by client reference ID or metadata
        const sessions = await this.stripe.checkout.sessions.list({
          limit: 20,
        });
        session = sessions.data.find(
          (s) => s.client_reference_id === referenceOrSessionId || s.metadata?.reference === referenceOrSessionId
        ) || null;

        if (session) {
          session = await this.stripe.checkout.sessions.retrieve(session.id, {
            expand: ['payment_intent', 'payment_intent.payment_method'],
          });
        }
      }

      if (!session) {
        throw new Error(`Stripe session not found for reference: ${referenceOrSessionId}`);
      }

      const isPaid = session.payment_status === 'paid';
      const reference = session.client_reference_id || session.metadata?.reference || referenceOrSessionId;

      let authDetails: any = null;
      const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;
      if (paymentIntent && typeof paymentIntent === 'object') {
        const paymentMethod = paymentIntent.payment_method as Stripe.PaymentMethod | null;
        if (paymentMethod && paymentMethod.card) {
          authDetails = {
            reusable: true,
            authorization_code: paymentMethod.id,
            last4: paymentMethod.card.last4,
            card_type: paymentMethod.card.brand,
            exp_month: String(paymentMethod.card.exp_month),
            exp_year: String(paymentMethod.card.exp_year),
            bank: paymentMethod.card.issuer || paymentMethod.card.brand,
          };
        }
      }

      return {
        status: isPaid ? 'success' : 'failed',
        amount: session.amount_total || 0, // In smallest currency unit (e.g. cents)
        currency: (session.currency || 'usd').toUpperCase(),
        reference,
        sessionId: session.id,
        metadata: session.metadata || {},
        authorization: authDetails,
      };
    } catch (error: any) {
      console.error('Error verifying Stripe payment:', error);
      throw new Error(error.message || 'Failed to verify Stripe payment');
    }
  }

  async chargeAuthorization(
    email: string,
    amount: number,
    currency: string = 'USD',
    reference: string,
    authorizationCode: string, // Stripe PaymentMethod ID (pm_...)
    metadata?: any
  ) {
    try {
      const stripeCurrency = (currency || 'USD').toLowerCase();
      const unitAmount = Math.round(amount * 100);

      // Retrieve PaymentMethod to extract associated customer
      let customerId: string | undefined;
      try {
        const paymentMethod = await this.stripe.paymentMethods.retrieve(authorizationCode);
        if (paymentMethod.customer) {
          customerId = typeof paymentMethod.customer === 'string' ? paymentMethod.customer : paymentMethod.customer.id;
        }
      } catch (pmErr) {
        console.warn('Could not retrieve payment method customer:', pmErr);
      }

      if (!customerId && email) {
        try {
          const customers = await this.stripe.customers.list({ email, limit: 1 });
          if (customers.data.length > 0) {
            customerId = customers.data[0].id;
          }
        } catch (cErr) {
          console.warn('Could not find customer by email for charge:', cErr);
        }
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: unitAmount,
        currency: stripeCurrency,
        payment_method: authorizationCode,
        ...(customerId ? { customer: customerId } : {}),
        confirm: true,
        off_session: true,
        receipt_email: email,
        metadata: {
          reference,
          paymentPlanId: metadata?.paymentPlanId ? String(metadata.paymentPlanId) : '',
          ...metadata,
        },
      });

      return {
        status: paymentIntent.status === 'succeeded' ? 'success' : 'pending',
        reference: paymentIntent.id,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: any) {
      console.error('Error charging saved Stripe card:', error);
      throw new Error(error.message || 'Failed to charge saved card via Stripe');
    }
  }
}
