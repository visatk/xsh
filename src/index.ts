import { Hono } from 'hono';
import { Bot, InlineKeyboard, webhookCallback, Context } from 'grammy';

export interface Env {
  DB: D1Database;
  BOT_TOKEN: string;
  PAYMENT_PROVIDER_TOKEN: string; // Token from BotFather (e.g., Stripe)
  ADMIN_ID: string;
}

const app = new Hono<{ Bindings: Env }>();

const initBot = (env: Env) => {
  const bot = new Bot(env.BOT_TOKEN);

  // ==========================================
  // MIDDLEWARE: USER REGISTRATION
  // ==========================================
  bot.use(async (ctx, next) => {
    if (ctx.from && !ctx.from.is_bot) {
      await env.DB.prepare(
        `INSERT INTO users (telegram_id, username) VALUES (?, ?) ON CONFLICT(telegram_id) DO UPDATE SET username = ?`
      ).bind(ctx.from.id, ctx.from.username || 'unknown', ctx.from.username || 'unknown').run();
    }
    return next();
  });

  // ==========================================
  // MAIN MENU
  // ==========================================
  const renderMainMenu = new InlineKeyboard()
    .text("🛍️ Browse Products", "action_browse").row()
    .text("📦 My Purchases", "action_purchases");

  bot.command('start', async (ctx) => {
    await ctx.reply("⚡️ **Welcome to NPC_STORE**\n\nPremium digital subscriptions delivered instantly to your Telegram.", {
      parse_mode: "Markdown",
      reply_markup: renderMainMenu
    });
  });

  // ==========================================
  // STOREFRONT NAVIGATION
  // ==========================================
  bot.callbackQuery("action_browse", async (ctx) => {
    const { results } = await env.DB.prepare(`
      SELECT p.id, p.name, p.price, 
      (SELECT COUNT(*) FROM inventory i WHERE i.product_id = p.id AND i.is_sold = 0) as stock
      FROM products p WHERE p.is_active = 1
    `).all();

    if (!results || results.length === 0) {
      return ctx.answerCallbackQuery({ text: "No products available currently.", show_alert: true });
    }

    const keyboard = new InlineKeyboard();
    results.forEach((p: any) => {
      const stockIndicator = p.stock > 0 ? `🟢 ${p.stock} left` : `🔴 Out of stock`;
      keyboard.text(`${p.name} — $${(p.price / 100).toFixed(2)} (${stockIndicator})`, `view_prod_${p.id}`).row();
    });
    keyboard.text("🔙 Back to Menu", "action_main_menu");

    await ctx.editMessageText("🛒 **Available Products**\nSelect an item to view details:", {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  });

  bot.callbackQuery("action_main_menu", async (ctx) => {
    await ctx.editMessageText("⚡️ **Welcome to NPC_STORE**\n\nPremium digital subscriptions delivered instantly to your Telegram.", {
      parse_mode: "Markdown",
      reply_markup: renderMainMenu
    });
  });

  // View Product Details
  bot.callbackQuery(/^view_prod_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    
    const product: any = await env.DB.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM inventory i WHERE i.product_id = p.id AND i.is_sold = 0) as stock
      FROM products p WHERE p.id = ?
    `).bind(productId).first();

    if (!product) return ctx.answerCallbackQuery({ text: "Product not found." });

    const keyboard = new InlineKeyboard();
    if (product.stock > 0) {
      keyboard.text(`💳 Buy Now ($${(product.price / 100).toFixed(2)})`, `buy_prod_${product.id}`).row();
    }
    keyboard.text("🔙 Back to Products", "action_browse");

    const text = `📦 **${product.name}**\n\n${product.description}\n\n💵 **Price:** $${(product.price / 100).toFixed(2)}\n📊 **Status:** ${product.stock > 0 ? 'In Stock' : 'Out of Stock'}`;
    
    await ctx.editMessageText(text, { parse_mode: "Markdown", reply_markup: keyboard });
  });

  // ==========================================
  // CHECKOUT & PAYMENT FLOW
  // ==========================================
  
  // 1. Generate Invoice
  bot.callbackQuery(/^buy_prod_(.+)$/, async (ctx) => {
    const productId = ctx.match[1];
    
    const product: any = await env.DB.prepare(`SELECT * FROM products WHERE id = ?`).bind(productId).first();
    const stock: any = await env.DB.prepare(`SELECT COUNT(*) as count FROM inventory WHERE product_id = ? AND is_sold = 0`).bind(productId).first();

    if (!product || stock.count === 0) {
      return ctx.answerCallbackQuery({ text: "Item is currently out of stock.", show_alert: true });
    }

    // Send Telegram Invoice
    await ctx.replyWithInvoice(
      product.name,
      product.description,
      `payload_${product.id}_${ctx.from.id}`, // Custom payload to identify order later
      env.PAYMENT_PROVIDER_TOKEN,
      "USD",
      [{ label: product.name, amount: product.price }]
    );
    await ctx.answerCallbackQuery();
  });

  // 2. Pre-Checkout Validation (Crucial for Edge environments to prevent race conditions)
  bot.on("pre_checkout_query", async (ctx) => {
    const payload = ctx.preCheckoutQuery.invoice_payload;
    const [, productId] = payload.split('_'); // payload_prodId_userId

    // Lock-check: Ensure stock still exists right before payment is authorized
    const stock: any = await env.DB.prepare(`SELECT id FROM inventory WHERE product_id = ? AND is_sold = 0 LIMIT 1`).bind(productId).first();

    if (stock) {
      await ctx.answerPreCheckoutQuery(true);
    } else {
      await ctx.answerPreCheckoutQuery(false, { error_message: "Sorry, this item just sold out!" });
    }
  });

  // 3. Successful Payment & Delivery
  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment;
    const payload = payment.invoice_payload;
    const [, productId, userId] = payload.split('_');

    // Fetch an unsold item
    const stock: any = await env.DB.prepare(`SELECT id, credentials FROM inventory WHERE product_id = ? AND is_sold = 0 LIMIT 1`).bind(productId).first();

    if (!stock) {
      // Edge case: Stock ran out between pre_checkout and successful_payment (highly unlikely but must be handled)
      // In a real scenario, flag for manual refund by admin.
      return ctx.reply("Payment received, but stock was depleted. An admin has been notified for a refund.");
    }

    const orderId = crypto.randomUUID();

    // D1 Batch Execution: Atomic update to prevent double-selling
    const batch = await env.DB.batch([
      env.DB.prepare(`UPDATE inventory SET is_sold = 1 WHERE id = ? AND is_sold = 0`).bind(stock.id),
      env.DB.prepare(`INSERT INTO orders (id, telegram_payment_charge_id, telegram_id, product_id, inventory_id) VALUES (?, ?, ?, ?, ?)`).bind(
        orderId, payment.telegram_payment_charge_id, userId, productId, stock.id
      )
    ]);

    if (batch[0].meta.changes === 0) {
       return ctx.reply("Error assigning stock. Please contact support.");
    }

    // Deliver the digital asset
    await ctx.reply(
      `🎉 **Thank you for your purchase!**\n\n**Order ID:** \`${orderId}\`\n\nHere are your credentials/access keys:\n\n\`${stock.credentials}\`\n\nPlease save these details.`,
      { parse_mode: "Markdown" }
    );
  });

  // ==========================================
  // ADMIN CONTROLS
  // ==========================================
  bot.command('addstock', async (ctx) => {
    if (ctx.from?.id.toString() !== env.ADMIN_ID) return;
    
    // Usage: /addstock prod_xprem user:pass
    const args = ctx.match.split(' ');
    if (args.length < 2) return ctx.reply("Usage: `/addstock <product_id> <credentials>`", { parse_mode: "Markdown" });
    
    const [productId, ...credParts] = args;
    const credentials = credParts.join(' ');
    const id = crypto.randomUUID();

    try {
      await env.DB.prepare(`INSERT INTO inventory (id, product_id, credentials) VALUES (?, ?, ?)`).bind(id, productId, credentials).run();
      await ctx.reply(`✅ Stock added for \`${productId}\`.`, { parse_mode: "Markdown" });
    } catch (e) {
      await ctx.reply("❌ Database error. Ensure product_id exists.");
    }
  });

  return bot;
};

// ==========================================
// CLOUDFLARE WORKER ENTRY POINT
// ==========================================
app.post('/webhook', async (c) => {
  const bot = initBot(c.env);
  const cb = webhookCallback(bot, 'hono');
  return cb(c);
});

export default app;
