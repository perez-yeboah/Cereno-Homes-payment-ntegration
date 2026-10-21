import { IPaymentProvider } from '../interfaces/IPaymentProvider';
import { PaystackService } from './paystack';
// import { CellulantService } from './cellulant';

export class PaymentFactory {
  static getProvider(providerName: string): IPaymentProvider {
    switch (providerName.toLowerCase()) {
      case 'paystack':
        return new PaystackService();
      case 'cellulant':
        // return new CellulantService();
        throw new Error('Cellulant provider not yet implemented');
      default:
        throw new Error(`Unsupported payment provider: ${providerName}`);
    }
  }
}
