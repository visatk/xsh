import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Bot, webhookCallback, Context } from 'grammy';

export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  ADMIN_ID: string;
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for the Web App frontend
app.use('/api/*', cors());

// ==========================================
// TELEGRAM BOT LOGIC (grammY)
// ==========================================
const initBot = (env: Env) => {
  const bot = new Bot(env.BOT_TOKEN);

  // Middleware: Register User
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      await env.DB.prepare(
        `INSERT INTO users (telegram_id, username) VALUES (?, ?) ON CONFLICT(telegram_id) DO UPDATE SET username = ?`
      ).bind(ctx.from.id, ctx.from.username || 'unknown', ctx.from.username || 'unknown').run();
    }
    return next();
  });

  // Command: Start
  bot.command('start', async (ctx) => {
    // In production, this URL would point to the deployed Vercel frontend
    const webAppUrl = "https://v0-npc-store-design.vercel.app/"; 
    await ctx.reply("Welcome to NPC_STORE. Tap below to open the shop.", {
      reply_markup: {
        inline_keyboard: [[{ text: "🛍️ Open Shop", web_app: { url: webAppUrl } }]]
      }
    });
  });

  // Admin Command: Add Inventory (/addstock <product_id> <credentials>)
  bot.command('addstock', async (ctx) => {
    if (ctx.from?.id.toString() !== env.ADMIN_ID) return ctx.reply("Unauthorized.");
    
    const args = ctx.match.split(' ');
    if (args.length < 2) return ctx.reply("Usage: /addstock <product_id> <credentials>");
    
    const [productId, ...credParts] = args;
    const credentials = credParts.join(' ');
    const id = crypto.randomUUID();

    try {
      await env.DB.prepare(
        `INSERT INTO inventory (id, product_id, credentials) VALUES (?, ?, ?)`
      ).bind(id, productId, credentials).run();
      await ctx.reply(`✅ Stock added for ${productId}.`);
    } catch (e) {
      await ctx.reply("❌ Failed. Ensure product_id exists.");
    }
  });

  // Admin Command: Stats
  bot.command('stats', async (ctx) => {
    if (ctx.from?.id.toString() !== env.ADMIN_ID) return;
    const sales = await env.DB.prepare(`SELECT COUNT(*) as count, SUM(price) as rev FROM orders JOIN products ON orders.product_id = products.id`).first();
    const inv = await env.DB.prepare(`SELECT COUNT(*) as count FROM inventory WHERE is_sold = 0`).first();
    
    await ctx.reply(`📊 **Store Stats**\nTotal Sales: ${sales?.count || 0}\nRevenue: $${((sales?.rev as number || 0) / 100).toFixed(2)}\nAvailable Stock: ${inv?.count || 0}`, { parse_mode: "Markdown" });
  });

  return bot;
};

// ==========================================
// REST API FOR WEB APP FRONTEND
// ==========================================

// Fetch Products with Stock Counts
app.get('/api/products', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT p.*, 
    (SELECT COUNT(*) FROM inventory i WHERE i.product_id = p.id AND i.is_sold = 0) as stock_available,
    (SELECT COUNT(*) FROM inventory i WHERE i.product_id = p.id AND i.is_sold = 1) as stock_sold
    FROM products p WHERE p.is_active = 1
  `).all();
  return c.json({ success: true, data: results });
});

// Process Order (Called by Web App after Crypto/Payment confirmation)
app.post('/api/orders', async (c) => {
  const { telegram_id, product_id } = await c.req.json();
  
  // 1. Check stock
  const stock = await c.env.DB.prepare(
    `SELECT id, credentials FROM inventory WHERE product_id = ? AND is_sold = 0 LIMIT 1`
  ).bind(product_id).first();

  if (!stock) return c.json({ success: false, message: "Out of stock" }, 400);

  // 2. Process Transaction (Atomic update)
  const orderId = crypto.randomUUID();
  const batch = await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE inventory SET is_sold = 1 WHERE id = ? AND is_sold = 0`).bind(stock.id),
    c.env.DB.prepare(`INSERT INTO orders (id, telegram_id, product_id, inventory_id) VALUES (?, ?, ?, ?)`).bind(orderId, telegram_id, product_id, stock.id)
  ]);

  // Ensure inventory update was successful (prevent race conditions)
  if (!batch[0].meta.changes) return c.json({ success: false, message: "Stock conflict, try again" }, 409);

  // 3. Deliver via Bot
  const bot = new Bot(c.env.BOT_TOKEN);
  await bot.api.sendMessage(
    telegram_id, 
    `🎉 **Purchase Successful!**\n\nHere are your details:\n\`${stock.credentials}\`\n\nThank you for shopping at NPC_STORE.`,
    { parse_mode: "Markdown" }
  );

  return c.json({ success: true, order_id: orderId });
});

// Webhook endpoint for Telegram
app.post('/webhook', async (c) => {
  const bot = initBot(c.env);
  const cb = webhookCallback(bot, 'hono');
  return cb(c);
});

export default app;
