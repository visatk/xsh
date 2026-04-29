import { Context } from 'grammy';
import { ShopDB } from '../db/queries';

// Format: /addproduct Name | Price | Description
export const handleAddProduct = async (ctx: Context, db: ShopDB) => {
  const text = ctx.message?.text?.replace('/addproduct ', '');
  if (!text) return ctx.reply("Format: /addproduct Name | Price | Description");

  const parts = text.split('|').map(p => p.trim());
  if (parts.length !== 3) return ctx.reply("Invalid format. Use: Name | Price | Description");

  const price = parseFloat(parts[1]);
  if (isNaN(price)) return ctx.reply("Price must be a valid number.");

  await db.addProduct(parts[0], parts[2], price);
  await ctx.reply(`✅ Product "${parts[0]}" added successfully.`);
};

// Format: /delproduct <id>
export const handleDelProduct = async (ctx: Context, db: ShopDB) => {
  const idStr = ctx.message?.text?.split(' ')[1];
  const id = parseInt(idStr || '');
  
  if (isNaN(id)) return ctx.reply("Format: /delproduct <product_id>");

  await db.deleteProduct(id);
  await ctx.reply(`🗑️ Product ID ${id} and its stock deleted.`);
};

// Format: 
// /addstock <product_id>
// key1
// key2
export const handleAddStock = async (ctx: Context, db: ShopDB) => {
  const lines = ctx.message?.text?.split('\n') || [];
  if (lines.length < 2) {
    return ctx.reply("Format:\n/addstock <product_id>\nkey1\nkey2");
  }

  const cmdLine = lines[0].split(' ');
  const productId = parseInt(cmdLine[1]);

  if (isNaN(productId)) return ctx.reply("Invalid product ID.");

  const credentials = lines.slice(1).filter(line => line.trim() !== '');
  
  if (credentials.length === 0) return ctx.reply("No keys provided.");

  const addedCount = await db.addStockBatch(productId, credentials);
  await ctx.reply(`✅ Added ${addedCount} keys to Product ID ${productId}.`);
};
