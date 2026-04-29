-- schema.sql
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    role TEXT DEFAULT 'user', -- 'user' or 'admin'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL, -- Stored in cents (e.g., $30.00 = 3000)
    duration TEXT, -- e.g., '3M', '1 Year'
    badge TEXT, -- e.g., 'Best Value', 'NEW'
    is_active INTEGER DEFAULT 1
);

CREATE TABLE inventory (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    credentials TEXT NOT NULL, -- The digital good (key, account details)
    is_sold INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    telegram_id INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    inventory_id TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (telegram_id) REFERENCES users(telegram_id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (inventory_id) REFERENCES inventory(id)
);

-- Insert an Admin and a Test Product
INSERT INTO users (telegram_id, username, role) VALUES (123456789, 'admin_user', 'admin');
INSERT INTO products (id, name, price, duration, badge) VALUES ('prod_xprem', 'X (Twitter) Verified Premium', 3000, '3M', 'Best Value');
