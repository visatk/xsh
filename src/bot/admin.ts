import { Composer } from "grammy";
import { BotContext } from "../types";
import { getUserStats, setBanStatus, getAllActiveUsers } from "../db/queries";

export const adminComposer = new Composer<BotContext>();

// Authorization Middleware
adminComposer.use(async (ctx, next) => {
  if (!ctx.from) return;

  const adminIds = (ctx.env.ADMIN_USER_IDS || "")
    .split(",")
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id));

  if (!adminIds.includes(ctx.from.id)) {
    return; // Drop silently
  }

  ctx.user = { id: ctx.from.id, isAdmin: true };
  await next();
});

// Admin Dashboard
adminComposer.command("admin", async (ctx) => {
  const stats = await getUserStats(ctx.env);
  
  const msg = `
👑 <b>Admin Dashboard</b> 👑

👥 <b>Total Users:</b> ${stats?.totalUsers || 0}
🚫 <b>Banned Users:</b> ${stats?.bannedUsers || 0}

<b>Available Commands:</b>
<code>/broadcast [message]</code> - Send message to all users
<code>/ban [user_id]</code> - Ban a user
<code>/unban [user_id]</code> - Unban a user
  `;
  await ctx.reply(msg, { parse_mode: "HTML" });
});

// Broadcast System
adminComposer.command("broadcast", async (ctx) => {
  const message = ctx.match;
  if (!message) {
    return ctx.reply("❌ Usage: <code>/broadcast Your message here</code>", { parse_mode: "HTML" });
  }

  await ctx.reply("⏳ Starting broadcast...");
  
  const users = await getAllActiveUsers(ctx.env);
  let successCount = 0;
  let failCount = 0;

  const broadcastPromises = users.map(userId => 
    ctx.api.sendMessage(userId, `📢 <b>Broadcast:</b>\n\n${message}`, { parse_mode: "HTML" })
      .then(() => { successCount++; })
      .catch(() => { failCount++; })
  );

  await Promise.allSettled(broadcastPromises);

  await ctx.reply(`✅ <b>Broadcast Complete</b>\nSent: ${successCount}\nFailed: ${failCount}`, { parse_mode: "HTML" });
});

// Ban Management
adminComposer.command("ban", async (ctx) => {
  const targetId = parseInt(ctx.match);
  if (isNaN(targetId)) return ctx.reply("❌ Invalid User ID.");

  await setBanStatus(ctx.env, targetId, true);
  await ctx.reply(`✅ User <code>${targetId}</code> banned.`, { parse_mode: "HTML" });
});

adminComposer.command("unban", async (ctx) => {
  const targetId = parseInt(ctx.match);
  if (isNaN(targetId)) return ctx.reply("❌ Invalid User ID.");

  await setBanStatus(ctx.env, targetId, false);
  await ctx.reply(`✅ User <code>${targetId}</code> unbanned.`, { parse_mode: "HTML" });
});
