import { Env } from "../types";

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

export async function checkIsAdmin(env: Env, userId: number): Promise<boolean> {
  const stmt = env.DB.prepare(`SELECT 1 FROM admins WHERE telegram_id = ?`);
  const result = await stmt.bind(userId).first();
  return !!result;
}
