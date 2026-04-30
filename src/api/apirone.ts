import { Env } from '../types';

/**
 * Generates a unique deposit address for a specific user.
 * We embed the user_id in the callback data so Apirone sends it back to us upon payment[cite: 2].
 */
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

    const response = await fetch(`https://apirone.com/api/v2/accounts/${env.APIRONE_ACCOUNT}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        console.error('Apirone Address Generation Error:', await response.text());
        return null;
    }

    const data = await response.json() as { address: string };
    return data.address;
}
