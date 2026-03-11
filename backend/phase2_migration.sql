-- Phase 2 Migration: Automation and Categories

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Modify existing transactions table 
-- Since SQLite (D1) doesn't allow adding FOREIGN KEY constraints via ALTER TABLE easily without recreating the table,
-- we'll just add the columns. In a production system at scale we'd recreate the table to enforce FKs, 
-- but for MVP, adding columns is safe and efficient.
ALTER TABLE transactions ADD COLUMN category_id TEXT;
ALTER TABLE transactions ADD COLUMN expense_type TEXT CHECK(expense_type IN ('fixed', 'variable') OR expense_type IS NULL);

-- 3. Create recurring_transactions table
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  category_id TEXT,
  expense_type TEXT CHECK(expense_type IN ('fixed', 'variable') OR expense_type IS NULL),
  description TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  next_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);
