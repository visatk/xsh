import { Env } from "../types";

export async function registerUser(
  env: Env, 
  user: { id: number; username: string | null; firstName: string }
) {
  const stmt = env.DB.prepare(`
    INSERT INTO users (telegram_id, username, first_name)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET 
      username = excluded.username,
      first_name = excluded.first_name
  `);
  await stmt.bind(user.id, user.username, user.firstName).run();
}

export async function getUserStats(env: Env) {
  const stmt = env.DB.prepare(`
    SELECT 
      COUNT(*) as totalUsers,
      SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) as bannedUsers
    FROM users
  `);
  const result = await stmt.first();
  return result;
}

export async function getAllActiveUsers(env: Env): Promise<number[]> {
  const stmt = env.DB.prepare(`SELECT telegram_id FROM users WHERE is_banned = 0`);
  const { results } = await stmt.all();
  return results.map((r) => r.telegram_id as number);
}

export async function setBanStatus(env: Env, userId: number, isBanned: boolean) {
  const stmt = env.DB.prepare(`UPDATE users SET is_banned = ? WHERE telegram_id = ?`);
  await stmt.bind(isBanned ? 1 : 0, userId).run();
}

/**
 * Idempotent processor for Apirone callbacks. Prevents double-crediting.
 */
export async function processDeposit(
    db: D1Database, 
    txHash: string, 
    userId: number, 
    currency: string, 
    amount: number, 
    confirmations: number
): Promise<void> {
    // Apirone requires 1-3 network confirmations to prevent double spending[cite: 2].
    const isConfirmed = confirmations >= 1; 
    const currentStatus = isConfirmed ? 'completed' : 'pending';

    const existing = await db.prepare('SELECT status FROM deposits WHERE tx_hash = ?')
                             .bind(txHash)
                             .first<{status: string}>();

    if (existing) {
        // If it was pending and is now confirmed, finalize it
        if (existing.status === 'pending' && isConfirmed) {
            await db.batch([
                db.prepare('UPDATE deposits SET status = ? WHERE tx_hash = ?').bind('completed', txHash),
                db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').bind(amount, userId)
            ]);
        }
    } else {
        // First time seeing this transaction (e.g., 0 confirmations)[cite: 2]
        const queries = [
            db.prepare(`
                INSERT INTO deposits (tx_hash, user_id, currency, amount, status) 
                VALUES (?, ?, ?, ?, ?)
            `).bind(txHash, userId, currency, amount, currentStatus)
        ];

        // If it somehow arrived with 1+ confirmations immediately, credit the user
        if (isConfirmed) {
            queries.push(
                db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ?').bind(amount, userId)
            );
        }

        await db.batch(queries);
    }
}
