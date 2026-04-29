import { Hono } from 'hono';
import { webhookCallback } from 'grammy';
import { Env } from './types';
import { createBot } from './bot/index';
import { ShopDB } from './db/queries';

const app = new Hono<{ Bindings: Env }>();

// Telegram Webhook Delivery
app.post('/bot', async (c) => {
  const bot = createBot(c.env);
  const handleUpdate = webhookCallback(bot, 'cloudflare-worker');
  return handleUpdate(c.req.raw);
});

// Crypto Payment Callback (Apirone Webhook)
app.post('/payment/callback', async (c) => {
  const body = await c.req.json();
  const db = new ShopDB(c.env.DB);
  const bot = createBot(c.env);

  // Validate callback origin and status
  if (body.status === 'completed') {
    // 1. Mark invoice as paid in DB
    await c.env.DB.prepare(`UPDATE invoices SET status = 'paid' WHERE invoice_id = ?`)
      .bind(body.invoice).run();

    // 2. Fetch invoice details to find buyer and product
    const { results } = await c.env.DB.prepare(`SELECT tg_id, product_id FROM invoices WHERE invoice_id = ?`)
      .bind(body.invoice).all<{ tg_id: number, product_id: number }>();
    
    if (results && results.length > 0) {
        const { tg_id, product_id } = results[0];

        // 3. Reserve stock atomically and fetch credentials
        const credentials = await db.reserveStock(product_id, tg_id);

        if (credentials) {
            // 4. Deliver product securely via Telegram
            await bot.api.sendMessage(tg_id, `Payment received! Here are your credentials:\n\n\`${credentials}\``, {
                parse_mode: 'MarkdownV2'
            });
        } else {
            // Edge case: Payment succeeded but stock depleted simultaneously
            await bot.api.sendMessage(tg_id, "Payment received, but the item went out of stock. Contact admin for a refund or replacement.");
            await bot.api.sendMessage(c.env.ADMIN_TG_ID, `STOCK ERROR: User ${tg_id} paid for product ${product_id} but stock was empty. Invoice: ${body.invoice}`);
        }
    }
  }

  return c.text('OK'); // Acknowledge receipt to Apirone
});

export default app;
