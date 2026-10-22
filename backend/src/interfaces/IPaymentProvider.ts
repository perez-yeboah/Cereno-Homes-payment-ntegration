export interface IPaymentProvider {
  initializePayment(
    email: string,
    amount: number,
    currency: string,
    reference: string,
    callbackUrl?: string,
    metadata?: any
  ): Promise<any>;

  verifyPayment(reference: string): Promise<any>;

  chargeAuthorization?(
    email: string,
    amount: number,
    currency: string,
    reference: string,
    authorizationCode: string,
    metadata?: any
  ): Promise<any>;
}
