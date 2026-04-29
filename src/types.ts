import { Context } from "grammy";

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  SETUP_SECRET: string;
  ADMIN_USER_IDS: string;
}

export interface BotContext extends Context {
  env: Env;
  user?: {
    id: number;
    isAdmin: boolean;
  };
}
