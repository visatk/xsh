-- Drop tables if they exist for clean migrations
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS transactions;

-- Users Table
CREATE TABLE users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    is_banned BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions Table (Integrating with your Apirone API)
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(telegram_id)
);

-- Admins (Hardcoded for security, or managed via D1. Here we use a table for dynamic management)
CREATE TABLE admins (
    telegram_id INTEGER PRIMARY KEY,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
