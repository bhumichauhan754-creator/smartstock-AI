# SmartStock AI Inventory Management System

SmartStock AI is a Django inventory-management project with a plain HTML, CSS, and vanilla JavaScript frontend and PostgreSQL database.

## Technology

- Python and Django
- PostgreSQL with Django ORM
- HTML, CSS, and vanilla JavaScript

## Set up locally

1. Copy `.env.example` to `.env`. Set `DB_PASSWORD` to the password for the dedicated `smartstock_app` role and replace `DJANGO_SECRET_KEY` with a private development key. Do not commit `.env` or share its password.

2. Install dependencies from the repository root:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r .\requirements.txt
   ```

3. On the configured PostgreSQL server, create a login role named `smartstock_app` and a database named `smartstock` owned by that role. Then create Django tables and start the server:

   ```sql
   CREATE ROLE smartstock_app WITH LOGIN PASSWORD 'your-strong-password';
   CREATE DATABASE smartstock OWNER smartstock_app;
   ```

   ```powershell
   .\.venv\Scripts\python.exe .\django_backend\manage.py migrate
   .\.venv\Scripts\python.exe .\django_backend\manage.py runserver
   ```

4. Open `http://127.0.0.1:8000/register/`.

The development configuration defaults to the separate PostgreSQL instance on port `5433`; it does not target the Odoo PostgreSQL service on port `5432`. For isolated local tests without PostgreSQL, set `$env:DJANGO_USE_SQLITE = "1"`. Django then uses a local SQLite database.

## Application features

- Django registration, login/logout, profile editing, workspace settings, and notification preferences.
- Workspace-scoped product and category management, supplier and customer directories, purchase orders, and sales invoices.
- Atomic Stock In and Stock Out transactions that update product quantities and record audit events.
- Dashboard metrics and stock movement charts, inventory reports with CSV export, and searchable audit history.
- Product, purchase, sales, and stock values use Indian Rupees (INR); enter prices in rupees.
- Plain HTML, CSS, and vanilla JavaScript; no frontend framework is required.

Purchase orders and sales invoices are separate from physical stock movements. Use Stock In or Stock Out to change available quantities.

## Run tests

Use the isolated SQLite database for tests without connecting to PostgreSQL:

```powershell
$env:DJANGO_USE_SQLITE = "1"
.\.venv\Scripts\python.exe .\django_backend\manage.py test accounts inventory
```

The generated Django migrations are applied by the setup steps above. Those steps target only the new `smartstock` database configured in the environment.

## Security

Do not commit `.env`, passwords, secret keys, virtual environments, or database dumps. Use a unique `DJANGO_SECRET_KEY` and set `DJANGO_DEBUG=false` outside local development.
