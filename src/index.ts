import { Bot, webhookCallback } from "grammy";
import { setupBot } from "./bot/index";
import { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Dynamic Webhook Registration
    // GET https://<worker-url>/_/setup-webhook?secret=<SETUP_SECRET>
    if (request.method === "GET" && url.pathname === "/_/setup-webhook") {
      const secret = url.searchParams.get("secret");
      if (secret !== env.SETUP_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
      const webhookUrl = `${url.origin}/bot-webhook`;
      
      await bot.api.setWebhook(webhookUrl, {
        drop_pending_updates: true,
      });

      return new Response(JSON.stringify({ status: "success", webhookUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Webhook Payload Handler
    if (request.method === "POST" && url.pathname === "/bot-webhook") {
      try {
        const bot = setupBot(env);
        const handleUpdate = webhookCallback(bot, "cloudflare-mod");
        return await handleUpdate(request);
      } catch (error) {
        console.error("Webhook processing error:", error);
        return new Response("OK", { status: 200 }); // Prevent Telegram retries on crash
      }
    }

    return new Response("Service Active", { status: 200 });
  },
};
