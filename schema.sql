DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL, -- Stored in cents (e.g., $30.00 = 3000)
    is_active INTEGER DEFAULT 1
);

CREATE TABLE inventory (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    credentials TEXT NOT NULL,
    is_sold INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    telegram_payment_charge_id TEXT UNIQUE NOT NULL,
    telegram_id INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);

-- Seed Initial Data
INSERT INTO products (id, name, description, price) 
VALUES ('prod_xprem', 'X Verified Premium', 'Includes SuperGROK reasoning.', 3000);
