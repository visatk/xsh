import { Composer } from "grammy";
import { BotContext } from "../types";
import { getUserStats, setBanStatus, getAllActiveUsers, checkIsAdmin } from "../db/queries";

export const adminComposer = new Composer<BotContext>();

// 1. Strict Security Middleware
adminComposer.use(async (ctx, next) => {
  if (!ctx.from) return;
  
  const isAdmin = await checkIsAdmin(ctx.env, ctx.from.id);
  if (!isAdmin) {
    // Silently ignore or alert unauthorized access
    console.warn(`Unauthorized admin access attempt by ${ctx.from.id}`);
    return;
  }
  
  ctx.user = { id: ctx.from.id, isAdmin: true };
  await next();
});

// 2. Dashboard Command
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

// 3. Broadcast System
adminComposer.command("broadcast", async (ctx) => {
  const message = ctx.match;
  if (!message) {
    return ctx.reply("❌ Please provide a message. Usage: <code>/broadcast Hello everyone!</code>", { parse_mode: "HTML" });
  }

  await ctx.reply("⏳ Starting broadcast...");
  
  const users = await getAllActiveUsers(ctx.env);
  let successCount = 0;
  let failCount = 0;

  // Note: For massive lists (10k+), this should be pushed to a Cloudflare Queue.
  // For standard sizes, Promise.allSettled works well within Worker limits.
  const broadcastPromises = users.map(userId => 
    ctx.api.sendMessage(userId, `📢 <b>Broadcast:</b>\n\n${message}`, { parse_mode: "HTML" })
      .then(() => { successCount++; })
      .catch(() => { failCount++; })
  );

  await Promise.allSettled(broadcastPromises);

  await ctx.reply(`✅ <b>Broadcast Complete!</b>\n\nSent: ${successCount}\nFailed: ${failCount}`, { parse_mode: "HTML" });
});

// 4. Ban / Unban Management
adminComposer.command("ban", async (ctx) => {
  const targetId = parseInt(ctx.match);
  if (isNaN(targetId)) return ctx.reply("❌ Invalid User ID.");

  await setBanStatus(ctx.env, targetId, true);
  await ctx.reply(`✅ User <code>${targetId}</code> has been banned.`, { parse_mode: "HTML" });
});

adminComposer.command("unban", async (ctx) => {
  const targetId = parseInt(ctx.match);
  if (isNaN(targetId)) return ctx.reply("❌ Invalid User ID.");

  await setBanStatus(ctx.env, targetId, false);
  await ctx.reply(`✅ User <code>${targetId}</code> has been unbanned.`, { parse_mode: "HTML" });
});
