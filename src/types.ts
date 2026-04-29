export interface Env {
  DB: D1Database;
  TG_BOT_TOKEN: string;
  APIRONE_ACCOUNT: string;
  ADMIN_TG_ID: string;
  WEBHOOK_SECRET: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price_usd: number;
  available_stock: number;
}
