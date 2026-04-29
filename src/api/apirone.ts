export class ApironeService {
  private readonly baseUrl = 'https://apirone.com/api/v2';

  constructor(private accountId: string) {}

  async createInvoice(amountUsd: number, currency: string = 'btc', callbackUrl: string) {
    // Note: In production, convert USD to Crypto dynamically based on exchange rates
    const amountCrypto = amountUsd * 0.000015; // Placeholder conversion logic

    const response = await fetch(`${this.baseUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: this.accountId,
        currency,
        amount: Math.floor(amountCrypto * 1e8), // Apirone expects minor units (Satoshi)
        lifetime: 1800, // 30 minutes
        callback_url: callbackUrl
      })
    });

    if (!response.ok) throw new Error('Payment gateway error');
    return response.json();
  }
}
