import { Bot, Context, NextFunction } from 'grammy';
import { Env } from '../types';
import { handleStart, handleShop } from './commands';
import { handleAddProduct, handleDelProduct, handleAddStock } from './admin';
import { ShopDB } from '../db/queries';

export const createBot = (env: Env) => {
  const bot = new Bot(env.TG_BOT_TOKEN);
  const db = new ShopDB(env.DB);

  // --- Public Commands ---
  bot.command("start", (ctx) => handleStart(ctx, db));
  bot.command("shop", (ctx) => handleShop(ctx, db));

  // --- Admin Middleware ---
  const adminAuth = async (ctx: Context, next: NextFunction) => {
    if (ctx.from?.id.toString() === env.ADMIN_TG_ID) {
      await next();
    } else {
      console.warn(`Unauthorized admin attempt by ${ctx.from?.id}`);
    }
  };

  // --- Admin Commands ---
  bot.command("addproduct", adminAuth, (ctx) => handleAddProduct(ctx, db));
  bot.command("delproduct", adminAuth, (ctx) => handleDelProduct(ctx, db));
  bot.command("addstock", adminAuth, (ctx) => handleAddStock(ctx, db));

  // --- Purchase Flow ---
  bot.on("callback_query:data", async (ctx) => {
    // Implementation for generating invoices...
  });

  return bot;
};
