import { Hono } from 'hono';
import { webhookCallback } from 'grammy';
import { Env } from './types';
import { setupBot } from './bot';
import { apirone } from './api/apirone';

const app = new Hono<{ Bindings: Env }>();

// Mount the Apirone Webhook API
app.route('/api', apirone);

// Mount the Telegram Bot Webhook
app.post('/webhook', async (c) => {
  const bot = setupBot(c.env);
  const cb = webhookCallback(bot, 'hono');
  return cb(c);
});

export default app;
