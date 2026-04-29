import { Bot, webhookCallback } from "grammy";
import { BotContext, Env } from "../types";
import { adminComposer } from "./admin";

export function setupBot(env: Env) {
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

  // Inject environment variables into context
  bot.use(async (ctx, next) => {
    ctx.env = env;
    await next();
  });

  // Register Admin Module
  bot.use(adminComposer);

  // Normal user commands
  bot.command("start", async (ctx) => {
    await ctx.reply("Welcome to the service!");
  });

  return bot;
}
