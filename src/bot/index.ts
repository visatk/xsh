import { Bot } from 'grammy';
import { Env } from '../types';
import { handleStart, handleShop } from './commands';
import { ShopDB } from '../db/queries';

export const createBot = (env: Env) => {
  const bot = new Bot(env.TG_BOT_TOKEN);
  const db = new ShopDB(env.DB);

  bot.command("start", (ctx) => handleStart(ctx, db));
  bot.command("shop", (ctx) => handleShop(ctx, db));

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    if (data.startsWith('buy_')) {
      const productId = parseInt(data.split('_')[1]);
      await ctx.answerCallbackQuery("Generating payment link...");
      
      // Invoice generation logic would connect with ApironeService here,
      // store the pending invoice in DB, and send the payment link to the user.
      await ctx.reply(`Please send payment to the provided crypto address.`);
    }
  });

  return bot;
};
