# SmartStock AI Inventory Management System

SmartStock AI is a Flask inventory application integrated with an existing Odoo PostgreSQL database. It demonstrates authentication, role management, product CRUD, stock movements, purchases, sales, reports, exports, audit history, and product reviews.

## Technology

- Python and Flask
- PostgreSQL and psycopg2
- Odoo product and stock tables
- HTML, CSS, JavaScript, and Bootstrap
- ReportLab for PDF exports
- openpyxl for Excel exports

## Run locally

1. Create and activate a Python virtual environment.
2. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` or set the variables in your shell:

   ```powershell
   $env:DB_HOST = "localhost"
   $env:DB_PORT = "5432"
   $env:DB_NAME = "odoo"
   $env:DB_USER = "odoo"
   $env:DB_PASSWORD = "your-password"
   $env:FLASK_SECRET_KEY = "your-long-random-secret"
   ```

4. Start the server:

   ```powershell
   python app.py
   ```

5. Open `http://127.0.0.1:5000/signup`.

## Main pages

- `/` - inventory dashboard
- `/products` - product management
- `/stock` - stock-in and stock-out
- `/purchase` - purchases
- `/sales` - sales
- `/reviews` - product reviews
- `/reports` - reports
- `/audit` - audit and exports
- `/admin` - user roles

## Odoo integration

The application reads and writes Odoo product-related tables including `product_template`, `product_product`, and `stock_quant`. For production Odoo deployments, a custom Odoo module using Odoo ORM and access rules is recommended instead of direct SQL writes.

## Security

Never commit `.env`, passwords, secret keys, virtual environments, or database dumps. Use environment variables for all deployment credentials.
