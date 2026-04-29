import { Hono } from 'hono';
import { webhookCallback } from 'grammy';
import { Env } from './types';
import { createBot } from './bot/index';
import { ShopDB } from './db/queries';

const app = new Hono<{ Bindings: Env }>();

app.post('/bot', async (c) => {
  const bot = createBot(c.env);
  const handleUpdate = webhookCallback(bot, 'cloudflare-worker');
  return handleUpdate(c.req.raw);
});

app.post('/payment/callback', async (c) => {
  const body = await c.req.json();
  const db = new ShopDB(c.env.DB);
  const bot = createBot(c.env);

  // Trigger delivery immediately upon 'completed' or 'paid' status
  if (body.status === 'completed' || body.status === 'paid') {
    
    // 1. Mark invoice as paid
    await c.env.DB.prepare(`UPDATE invoices SET status = 'paid' WHERE invoice_id = ?`)
      .bind(body.invoice).run();

    // 2. Retrieve invoice routing data
    const { results: invoiceResults } = await c.env.DB.prepare(
      `SELECT tg_id, product_id FROM invoices WHERE invoice_id = ?`
    ).bind(body.invoice).all<{ tg_id: number, product_id: number }>();
    
    if (invoiceResults && invoiceResults.length > 0) {
        const { tg_id, product_id } = invoiceResults[0];

        // 3. Atomically extract the real credential from stock
        const credentials = await db.reserveStock(product_id, tg_id);

        if (credentials) {
            // 4. INSTANT DELIVERY via Telegram API
            await bot.api.sendMessage(
              tg_id, 
              `✅ **Payment Confirmed!**\n\nHere is your product data:\n\n\`\`\`\n${credentials}\n\`\`\`\nThank you for your purchase!`, 
              { parse_mode: 'MarkdownV2' }
            );
        } else {
            // Failsafe for race conditions
            await bot.api.sendMessage(tg_id, "Payment received, but inventory is unexpectedly depleted. The administrator has been notified to process your refund or replacement.");
            await bot.api.sendMessage(c.env.ADMIN_TG_ID, `🚨 **STOCK ERROR**\nUser: ${tg_id}\nProduct: ${product_id}\nInvoice: ${body.invoice}`);
        }
    }
  }

  return c.text('OK');
});

export default app;
