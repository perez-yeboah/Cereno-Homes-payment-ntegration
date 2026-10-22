import { IPaymentProvider } from '../interfaces/IPaymentProvider';
import { StripeService } from './stripe';
import { PaystackService } from './paystack';
// import { CellulantService } from './cellulant';

export class PaymentFactory {
  static getProvider(providerName: string = 'stripe'): IPaymentProvider {
    switch (providerName.toLowerCase()) {
      case 'stripe':
        return new StripeService();
      case 'paystack':
        return new PaystackService();
      case 'cellulant':
        // return new CellulantService();
        throw new Error('Cellulant provider not yet implemented');
      default:
        // Default to Stripe
        return new StripeService();
    }
  }
}
