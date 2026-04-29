import { Bot } from "grammy";
import { BotContext, Env } from "../types";
import { adminComposer } from "./admin";
import { commandsComposer } from "./commands";

export function setupBot(env: Env): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.TELEGRAM_BOT_TOKEN);

  // Inject bindings
  bot.use(async (ctx, next) => {
    ctx.env = env;
    await next();
  });

  bot.catch((err) => {
    console.error(`Update ${err.ctx.update.update_id} failed:`, err.error);
  });

  // Attach Public Commands (Start, Help)
  bot.use(commandsComposer);

  // Attach Admin Commands (Gated by internal middleware)
  bot.use(adminComposer);

  return bot;
}
