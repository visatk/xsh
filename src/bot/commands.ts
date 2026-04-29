import { Composer } from "grammy";
import { BotContext } from "../types";
import { registerUser } from "../db/queries";

export const commandsComposer = new Composer<BotContext>();

commandsComposer.command("start", async (ctx) => {
  if (!ctx.from) return;

  // Insert or update the user in the database
  await registerUser(ctx.env, {
    id: ctx.from.id,
    username: ctx.from.username || null,
    firstName: ctx.from.first_name,
  });

  const msg = `
👋 <b>Welcome, ${ctx.from.first_name}!</b>

Your account has been successfully registered. 
Use /help to discover available features.
  `;
  await ctx.reply(msg, { parse_mode: "HTML" });
});

commandsComposer.command("help", async (ctx) => {
  const msg = `
🤖 <b>Bot Commands</b>

/start - Register and initialize the bot
/help - Show this help message
/profile - View your account status (Example)

<i>Administrative commands are hidden from public view.</i>
  `;
  await ctx.reply(msg, { parse_mode: "HTML" });
});
