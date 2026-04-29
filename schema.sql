PRAGMA foreign_keys = ON;

CREATE TABLE users (
    tg_id INTEGER PRIMARY KEY,
    username TEXT,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price_usd REAL NOT NULL
);

CREATE TABLE stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    credentials TEXT NOT NULL,
    is_sold BOOLEAN DEFAULT 0,
    buyer_id INTEGER,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(buyer_id) REFERENCES users(tg_id)
);

CREATE TABLE invoices (
    invoice_id TEXT PRIMARY KEY,
    tg_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    amount_crypto TEXT NOT NULL,
    currency TEXT NOT NULL,
    address TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(tg_id) REFERENCES users(tg_id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE INDEX idx_stock_product ON stock(product_id);
CREATE INDEX idx_invoices_status ON invoices(status);
