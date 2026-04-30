import { Env } from '../types';

export async function generateDepositAddress(env: Env, currency: string, userId: number): Promise<string | null> {
    const payload = {
        currency: currency,
        callback: {
            method: "POST",
            url: `${env.APP_URL}/webhook/apirone`,
            data: {
                user_id: userId.toString()
            }
        }
    };

    try {
        const response = await fetch(`https://apirone.com/api/v2/accounts/${env.APIRONE_ACCOUNT}/addresses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error('Apirone API Error:', await response.text());
            return null;
        }

        const data = await response.json() as { address: string };
        return data.address;
    } catch (error) {
        console.error('Apirone Fetch Exception:', error);
        return null;
    }
}
