import { Context } from "grammy";

export interface Env {
  // Cloudflare D1 Binding
  DB: D1Database;
  // Environment variables
  TELEGRAM_BOT_TOKEN: string;
  APIRONE_ACCOUNT: string;
}

// Custom Grammy Context to include Cloudflare environment
export interface BotContext extends Context {
  env: Env;
  user?: {
    id: number;
    isAdmin: boolean;
  };
}
