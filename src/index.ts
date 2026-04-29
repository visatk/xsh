import { setupBot } from "./bot/index";
import { Env } from "./types";
import { webhookCallback } from "grammy";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Secure webhook path
    if (request.method === "POST" && url.pathname === "/bot-webhook") {
      const bot = setupBot(env);
      const handleUpdate = webhookCallback(bot, "cloudflare-mod");
      return handleUpdate(request);
    }

    return new Response("Bot is running securely.", { status: 200 });
  },
};
