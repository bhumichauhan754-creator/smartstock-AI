"""Helpers for connecting to PostgreSQL."""

from contextlib import contextmanager
from typing import Any, Iterator

import psycopg2
from psycopg2.extensions import connection

from config import Config


APPLICATION_SCHEMA = """
CREATE TABLE IF NOT EXISTS smartstock_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(30) UNIQUE NOT NULL
);
INSERT INTO smartstock_roles (name) VALUES ('admin'), ('user')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS smartstock_users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES smartstock_roles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE smartstock_users
    ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES smartstock_roles(id);
UPDATE smartstock_users
SET role_id = (SELECT id FROM smartstock_roles WHERE name = 'user')
WHERE role_id IS NULL;

CREATE TABLE IF NOT EXISTS smartstock_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS smartstock_suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(255) NOT NULL DEFAULT '',
    phone VARCHAR(50) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS smartstock_customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(255) NOT NULL DEFAULT '',
    phone VARCHAR(50) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS smartstock_stock_transactions (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('in', 'out')),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    notes TEXT NOT NULL DEFAULT '',
    user_id INTEGER REFERENCES smartstock_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS smartstock_password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES smartstock_users(id) ON DELETE CASCADE,
    token VARCHAR(120) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS smartstock_purchase_orders (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES smartstock_suppliers(id),
    product_id INTEGER NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'received',
    created_by INTEGER REFERENCES smartstock_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS smartstock_sales_orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES smartstock_customers(id),
    product_id INTEGER NOT NULL,
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    created_by INTEGER REFERENCES smartstock_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS smartstock_product_reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES smartstock_users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def initialize_schema() -> None:
    """Create SmartStock application tables without modifying Odoo tables."""
    with get_db_connection() as db_connection:
        with db_connection.cursor() as cursor:
            cursor.execute(APPLICATION_SCHEMA)


@contextmanager
def get_db_connection() -> Iterator[connection]:
    """Open a database connection and close it after the request."""
    db_connection = None
    try:
        db_connection = psycopg2.connect(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            dbname=Config.DB_NAME,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
        )
        yield db_connection
        db_connection.commit()
    except Exception:
        if db_connection is not None:
            db_connection.rollback()
        raise
    finally:
        if db_connection is not None:
            db_connection.close()


@contextmanager
def get_db_cursor() -> Iterator[Any]:
    """Open a cursor and close both the cursor and connection safely."""
    with get_db_connection() as db_connection:
        with db_connection.cursor() as cursor:
            yield cursor
