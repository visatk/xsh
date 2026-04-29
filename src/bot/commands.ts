import { Context } from 'grammy';
import { ShopDB } from '../db/queries';

export const handleStart = async (ctx: Context, db: ShopDB) => {
  await db.registerUser(ctx.from!.id, ctx.from!.username);
  await ctx.reply("Welcome to the Premium Accounts Shop.\nUse /shop to browse our catalog.");
};

export const handleShop = async (ctx: Context, db: ShopDB) => {
  const products = await db.getAvailableProducts();
  
  if (products.length === 0) {
    return ctx.reply("The shop is currently empty.");
  }

  const buttons = products.map(p => ([{
    text: `${p.name} - $${p.price_usd} (${p.available_stock} in stock)`,
    callback_data: `buy_${p.id}`
  }]));

  await ctx.reply("Available Products:", {
    reply_markup: { inline_keyboard: buttons }
  });
};
