export interface IPaymentProvider {
  initializePayment(
    email: string,
    amountGHS: number,
    currency: string,
    reference: string,
    callbackUrl?: string,
    metadata?: any
  ): Promise<any>;

  verifyPayment(reference: string): Promise<any>;

  chargeAuthorization?(
    email: string,
    amountGHS: number,
    currency: string,
    reference: string,
    authorizationCode: string,
    metadata?: any
  ): Promise<any>;
}
