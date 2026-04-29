import { Env, Product } from '../types';

export class ShopDB {
  constructor(private db: D1Database) {}

  async registerUser(tgId: number, username: string = '') {
    await this.db.prepare(
      `INSERT INTO users (tg_id, username) VALUES (?, ?) ON CONFLICT(tg_id) DO NOTHING`
    ).bind(tgId, username).run();
  }

  async getAvailableProducts(): Promise<Product[]> {
    const { results } = await this.db.prepare(`
      SELECT p.*, COUNT(s.id) as available_stock 
      FROM products p 
      LEFT JOIN stock s ON p.id = s.product_id AND s.is_sold = 0 
      GROUP BY p.id
    `).all<Product>();
    return results ?? [];
  }

  async reserveStock(productId: number, tgId: number): Promise<string | null> {
    // Atomic update to prevent race conditions during high concurrency
    const { results } = await this.db.prepare(`
      UPDATE stock SET is_sold = 1, buyer_id = ? 
      WHERE id = (SELECT id FROM stock WHERE product_id = ? AND is_sold = 0 LIMIT 1) 
      RETURNING credentials
    `).bind(tgId, productId).all<{ credentials: string }>();
    
    return results?.[0]?.credentials || null;
  }
}

  // --- Admin Methods ---

  async addProduct(name: string, description: string, priceUsd: number): Promise<void> {
    await this.db.prepare(
      `INSERT INTO products (name, description, price_usd) VALUES (?, ?, ?)`
    ).bind(name, description, priceUsd).run();
  }

  async editProduct(id: number, name: string, description: string, priceUsd: number): Promise<void> {
    await this.db.prepare(
      `UPDATE products SET name = ?, description = ?, price_usd = ? WHERE id = ?`
    ).bind(name, description, priceUsd, id).run();
  }

  async deleteProduct(id: number): Promise<void> {
    // Delete stock associated with the product first to maintain referential integrity
    await this.db.batch([
      this.db.prepare(`DELETE FROM stock WHERE product_id = ?`).bind(id),
      this.db.prepare(`DELETE FROM products WHERE id = ?`).bind(id)
    ]);
  }

  async addStockBatch(productId: number, credentialsList: string[]): Promise<number> {
    // Utilize D1 batching for high-performance bulk inserts
    const stmt = this.db.prepare(`INSERT INTO stock (product_id, credentials) VALUES (?, ?)`);
    const batchStmts = credentialsList.map(cred => stmt.bind(productId, cred.trim()));
    
    await this.db.batch(batchStmts);
    return batchStmts.length;
  }
}
