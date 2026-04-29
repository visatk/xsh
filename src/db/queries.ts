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
