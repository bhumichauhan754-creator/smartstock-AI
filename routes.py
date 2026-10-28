"""API routes for SmartStock AI."""

from decimal import Decimal
from functools import wraps
from io import BytesIO, StringIO
import csv
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from flask import Blueprint, jsonify, request, session, send_file, Response
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from openpyxl import Workbook
from werkzeug.security import check_password_hash, generate_password_hash

from database import get_db_cursor


api = Blueprint("api", __name__, url_prefix="/api")

# Odoo stores product names and prices on product_template. Stock quantities
# are stored per product variant in stock_quant.
PRODUCTS_QUERY = """
    SELECT
        pp.id AS product_id,
        pt.name AS product_name,
        COALESCE(SUM(sq.quantity), 0) AS quantity,
        COALESCE(NULLIF(pp.standard_price ->> 'en_US', '')::numeric, 0) AS unit_price
    FROM product_product AS pp
    JOIN product_template AS pt ON pt.id = pp.product_tmpl_id
    LEFT JOIN stock_quant AS sq ON sq.product_id = pp.id
    GROUP BY pp.id, pt.name, pp.standard_price
    ORDER BY pp.id
"""

LOW_STOCK_QUERY = f"""
    SELECT product_id, product_name, quantity, unit_price
    FROM ({PRODUCTS_QUERY.rstrip(";")}) AS products
    WHERE quantity < 10
    ORDER BY quantity, product_id
"""

DASHBOARD_STATS_QUERY = f"""
    SELECT
        COUNT(*) AS total_products,
        COALESCE(SUM(quantity * unit_price), 0) AS total_stock_value,
        COUNT(*) FILTER (WHERE quantity < 10) AS low_stock_count
    FROM ({PRODUCTS_QUERY.rstrip(";")}) AS products
"""

CREATE_PRODUCT_QUERY = """
    INSERT INTO product_template (
        uom_id, company_id, type, service_tracking, name, list_price,
        tracking, sale_ok, purchase_ok, active, is_storable,
        create_date, write_date
    )
    VALUES (
        1, 1, 'consu', 'no', jsonb_build_object('en_US', %s), %s,
        'none', TRUE, TRUE, TRUE, TRUE, NOW(), NOW()
    )
    RETURNING id
"""

CREATE_VARIANT_QUERY = """
    INSERT INTO product_product (
        product_tmpl_id, standard_price, active, create_date, write_date
    )
    VALUES (%s, jsonb_build_object('en_US', %s), TRUE, NOW(), NOW())
    RETURNING id
"""

CREATE_QUANT_QUERY = """
    INSERT INTO stock_quant (
        product_id, company_id, location_id, quantity, reserved_quantity,
        in_date, create_date, write_date
    )
    VALUES (%s, 1, 5, %s, 0, NOW(), NOW(), NOW())
"""

AUTH_TABLE_QUERY = """
    CREATE TABLE IF NOT EXISTS smartstock_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role_id INTEGER REFERENCES smartstock_roles(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
"""

HISTORY_TABLE_QUERY = """
    CREATE TABLE IF NOT EXISTS smartstock_inventory_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        action VARCHAR(20) NOT NULL,
        product_name VARCHAR(120) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
"""


def _require_auth(view):
    """Require a logged-in user for an API endpoint."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Please log in to continue"}), 401
        return view(*args, **kwargs)

    return wrapped


def _require_admin(view):
    @wraps(view)
    @_require_auth
    def wrapped(*args, **kwargs):
        with get_db_cursor() as cursor:
            cursor.execute("SELECT r.name FROM smartstock_users u JOIN smartstock_roles r ON r.id = u.role_id WHERE u.id = %s", (session["user_id"],))
            role = cursor.fetchone()
        if role is None or role[0] != "admin":
            return jsonify({"error": "Admin access is required"}), 403
        return view(*args, **kwargs)
    return wrapped


def _ensure_auth_table(cursor) -> None:
    cursor.execute(AUTH_TABLE_QUERY)


def _record_history(cursor, action: str, product_name: str) -> None:
    cursor.execute(HISTORY_TABLE_QUERY)
    cursor.execute(
        "INSERT INTO smartstock_inventory_history (user_id, action, product_name) VALUES (%s, %s, %s)",
        (session["user_id"], action, product_name),
    )


def _json_value(value: Any) -> Any:
    """Convert PostgreSQL Decimal values to JSON-compatible numbers."""
    if isinstance(value, Decimal):
        return float(value)
    return value


def _product_name(value: Any) -> str:
    """Read the English name from either old or new Odoo name formats."""
    if isinstance(value, dict):
        return str(value.get("en_US") or next(iter(value.values()), ""))
    return str(value or "")


def _product_from_row(row: tuple[Any, ...]) -> dict[str, Any]:
    """Convert a database row into the public product response shape."""
    return {
        "id": row[0],
        "name": _product_name(row[1]),
        "quantity": _json_value(row[2]),
        "unit_price": _json_value(row[3]),
    }


@api.post("/auth/signup")
def signup():
    """Create a user account and start a session."""
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not name or not email or len(password) < 8:
        return jsonify({"error": "Name, email, and a password of at least 8 characters are required"}), 400

    with get_db_cursor() as cursor:
        _ensure_auth_table(cursor)
        cursor.execute("SELECT id FROM smartstock_users WHERE email = %s", (email,))
        if cursor.fetchone() is not None:
            return jsonify({"error": "An account with this email already exists"}), 409
        cursor.execute(
            """
            INSERT INTO smartstock_users (name, email, password_hash, role_id)
            VALUES (%s, %s, %s, (SELECT id FROM smartstock_roles WHERE name = 'user'))
            RETURNING id, name, email, role_id
            """,
            (name, email, generate_password_hash(password)),
        )
        user = cursor.fetchone()

    session["user_id"] = user[0]
    session["user_name"] = user[1]
    session["user_role"] = "user"
    return jsonify({"user": {"name": user[1], "email": user[2]}}), 201


@api.post("/auth/login")
def login():
    """Authenticate a user and start a session."""
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    with get_db_cursor() as cursor:
        _ensure_auth_table(cursor)
        cursor.execute(
            "SELECT u.id, u.name, u.email, u.password_hash, r.name FROM smartstock_users u JOIN smartstock_roles r ON r.id = u.role_id WHERE u.email = %s",
            (email,),
        )
        user = cursor.fetchone()
    if user is None or not check_password_hash(user[3], password):
        return jsonify({"error": "Invalid email or password"}), 401

    session["user_id"] = user[0]
    session["user_name"] = user[1]
    session["user_role"] = user[4]
    return jsonify({"user": {"name": user[1], "email": user[2]}})


@api.post("/auth/logout")
def logout():
    """End the current user session."""
    session.clear()
    return jsonify({"message": "Logged out successfully"})


@api.get("/auth/me")
def current_user():
    """Return the current session user, if logged in."""
    if "user_id" not in session:
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "name": session["user_name"], "role": session.get("user_role")})


@api.post("/auth/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    token = secrets.token_urlsafe(32)
    with get_db_cursor() as cursor:
        cursor.execute("SELECT id FROM smartstock_users WHERE email = %s", (email,))
        user = cursor.fetchone()
        if user:
            cursor.execute(
                "INSERT INTO smartstock_password_reset_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
                (user[0], token, datetime.now(timezone.utc) + timedelta(hours=1)),
            )
    return jsonify({"message": "If that email exists, a reset token has been created.", "development_token": token if user else None})


@api.post("/auth/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = str(data.get("token", ""))
    password = str(data.get("password", ""))
    if len(password) < 8:
        return jsonify({"error": "Password must contain at least 8 characters"}), 400
    with get_db_cursor() as cursor:
        cursor.execute(
            "SELECT user_id FROM smartstock_password_reset_tokens WHERE token = %s AND used_at IS NULL AND expires_at > NOW()",
            (token,),
        )
        row = cursor.fetchone()
        if row is None:
            return jsonify({"error": "Invalid or expired reset token"}), 400
        cursor.execute("UPDATE smartstock_users SET password_hash = %s WHERE id = %s", (generate_password_hash(password), row[0]))
        cursor.execute("UPDATE smartstock_password_reset_tokens SET used_at = NOW() WHERE token = %s", (token,))
    return jsonify({"message": "Password reset successfully"})


@api.get("/profile")
@_require_auth
def profile():
    with get_db_cursor() as cursor:
        _ensure_auth_table(cursor)
        cursor.execute("SELECT id, name, email, created_at FROM smartstock_users WHERE id = %s", (session["user_id"],))
        user = cursor.fetchone()
    if user is None:
        session.clear()
        return jsonify({"error": "User account was not found"}), 404
    return jsonify({"id": user[0], "name": user[1], "email": user[2], "created_at": user[3].isoformat()})


@api.put("/profile")
@_require_auth
def update_profile():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    with get_db_cursor() as cursor:
        _ensure_auth_table(cursor)
        cursor.execute("UPDATE smartstock_users SET name = %s WHERE id = %s", (name, session["user_id"]))
    session["user_name"] = name
    return jsonify({"message": "Profile updated successfully"})


def _collection_response(cursor, table: str) -> list[dict[str, Any]]:
    cursor.execute(f"SELECT id, name, email, phone, address FROM {table} ORDER BY id DESC")
    return [
        {"id": row[0], "name": row[1], "email": row[2], "phone": row[3], "address": row[4]}
        for row in cursor.fetchall()
    ]


@api.get("/categories")
@_require_auth
def get_categories():
    with get_db_cursor() as cursor:
        cursor.execute("SELECT id, name, description FROM smartstock_categories ORDER BY name")
        return jsonify([{"id": row[0], "name": row[1], "description": row[2]} for row in cursor.fetchall()])


@api.post("/categories")
@_require_auth
def create_category():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Category name is required"}), 400
    with get_db_cursor() as cursor:
        cursor.execute("INSERT INTO smartstock_categories (name, description) VALUES (%s, %s) RETURNING id", (name, str(data.get("description", "")).strip()))
        return jsonify({"id": cursor.fetchone()[0], "message": "Category created"}), 201


@api.get("/suppliers")
@_require_auth
def get_suppliers():
    with get_db_cursor() as cursor:
        return jsonify(_collection_response(cursor, "smartstock_suppliers"))


@api.post("/suppliers")
@_require_auth
def create_supplier():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Supplier name is required"}), 400
    with get_db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO smartstock_suppliers (name, email, phone, address) VALUES (%s, %s, %s, %s) RETURNING id",
            (name, str(data.get("email", "")).strip(), str(data.get("phone", "")).strip(), str(data.get("address", "")).strip()),
        )
        return jsonify({"id": cursor.fetchone()[0], "message": "Supplier created"}), 201


@api.get("/customers")
@_require_auth
def get_customers():
    with get_db_cursor() as cursor:
        return jsonify(_collection_response(cursor, "smartstock_customers"))


@api.post("/customers")
@_require_auth
def create_customer():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Customer name is required"}), 400
    with get_db_cursor() as cursor:
        cursor.execute(
            "INSERT INTO smartstock_customers (name, email, phone, address) VALUES (%s, %s, %s, %s) RETURNING id",
            (name, str(data.get("email", "")).strip(), str(data.get("phone", "")).strip(), str(data.get("address", "")).strip()),
        )
        return jsonify({"id": cursor.fetchone()[0], "message": "Customer created"}), 201


@api.post("/stock-transactions")
@_require_auth
def create_stock_transaction():
    data = request.get_json(silent=True) or {}
    try:
        product_id = int(data.get("product_id"))
        quantity = float(data.get("quantity"))
    except (TypeError, ValueError):
        return jsonify({"error": "Product ID and quantity must be valid numbers"}), 400
    transaction_type = str(data.get("transaction_type", "")).lower()
    if transaction_type not in {"in", "out"} or quantity <= 0:
        return jsonify({"error": "Transaction type must be 'in' or 'out' and quantity must be positive"}), 400
    with get_db_cursor() as cursor:
        cursor.execute("SELECT id FROM product_product WHERE id = %s", (product_id,))
        if cursor.fetchone() is None:
            return jsonify({"error": "Product not found"}), 404
        cursor.execute(
            "INSERT INTO smartstock_stock_transactions (product_id, transaction_type, quantity, notes, user_id) VALUES (%s, %s, %s, %s, %s)",
            (product_id, transaction_type, quantity, str(data.get("notes", "")).strip(), session["user_id"]),
        )
        signed_quantity = quantity if transaction_type == "in" else -quantity
        cursor.execute("SELECT id FROM stock_quant WHERE product_id = %s LIMIT 1", (product_id,))
        quant = cursor.fetchone()
        if quant is None:
            if signed_quantity < 0:
                return jsonify({"error": "Stock cannot become negative"}), 400
            cursor.execute(CREATE_QUANT_QUERY, (product_id, signed_quantity))
        else:
            cursor.execute("UPDATE stock_quant SET quantity = quantity + %s, write_date = NOW() WHERE product_id = %s AND quantity + %s >= 0", (signed_quantity, product_id, signed_quantity))
            if cursor.rowcount == 0:
                return jsonify({"error": "Stock cannot become negative"}), 400
    return jsonify({"message": "Stock transaction recorded"}), 201


def _change_stock(cursor, product_id: int, amount: float) -> None:
    cursor.execute("SELECT id FROM product_product WHERE id = %s", (product_id,))
    if cursor.fetchone() is None:
        raise ValueError("Product not found")
    cursor.execute("SELECT id FROM stock_quant WHERE product_id = %s LIMIT 1", (product_id,))
    quant = cursor.fetchone()
    if quant is None:
        if amount < 0:
            raise ValueError("Stock cannot become negative")
        cursor.execute(CREATE_QUANT_QUERY, (product_id, amount))
    else:
        cursor.execute(
            "UPDATE stock_quant SET quantity = quantity + %s, write_date = NOW() WHERE product_id = %s AND quantity + %s >= 0",
            (amount, product_id, amount),
        )
        if cursor.rowcount == 0:
            raise ValueError("Stock cannot become negative")


@api.post("/purchases")
@_require_auth
def create_purchase():
    data = request.get_json(silent=True) or {}
    try:
        product_id, quantity, unit_price = int(data["product_id"]), float(data["quantity"]), float(data["unit_price"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Product, quantity, and unit price are required"}), 400
    if quantity <= 0 or unit_price < 0:
        return jsonify({"error": "Quantity must be positive and price cannot be negative"}), 400
    with get_db_cursor() as cursor:
        try:
            _change_stock(cursor, product_id, quantity)
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        cursor.execute(
            "INSERT INTO smartstock_purchase_orders (supplier_id, product_id, quantity, unit_price, created_by) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (data.get("supplier_id") or None, product_id, quantity, unit_price, session["user_id"]),
        )
        order_id = cursor.fetchone()[0]
    return jsonify({"id": order_id, "message": "Purchase recorded"}), 201


@api.get("/purchases")
@_require_auth
def get_purchases():
    with get_db_cursor() as cursor:
        cursor.execute("SELECT id, supplier_id, product_id, quantity, unit_price, status, created_at FROM smartstock_purchase_orders ORDER BY id DESC")
        return jsonify([{"id": r[0], "supplier_id": r[1], "product_id": r[2], "quantity": float(r[3]), "unit_price": float(r[4]), "status": r[5], "created_at": r[6].isoformat()} for r in cursor.fetchall()])


@api.post("/sales")
@_require_auth
def create_sale():
    data = request.get_json(silent=True) or {}
    try:
        product_id, quantity, unit_price = int(data["product_id"]), float(data["quantity"]), float(data["unit_price"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Product, quantity, and unit price are required"}), 400
    if quantity <= 0 or unit_price < 0:
        return jsonify({"error": "Quantity must be positive and price cannot be negative"}), 400
    with get_db_cursor() as cursor:
        try:
            _change_stock(cursor, product_id, -quantity)
        except ValueError as error:
            return jsonify({"error": str(error)}), 400
        cursor.execute(
            "INSERT INTO smartstock_sales_orders (customer_id, product_id, quantity, unit_price, created_by) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (data.get("customer_id") or None, product_id, quantity, unit_price, session["user_id"]),
        )
        order_id = cursor.fetchone()[0]
    return jsonify({"id": order_id, "message": "Sale recorded"}), 201


@api.get("/sales")
@_require_auth
def get_sales():
    with get_db_cursor() as cursor:
        cursor.execute("SELECT id, customer_id, product_id, quantity, unit_price, status, created_at FROM smartstock_sales_orders ORDER BY id DESC")
        return jsonify([{"id": r[0], "customer_id": r[1], "product_id": r[2], "quantity": float(r[3]), "unit_price": float(r[4]), "status": r[5], "created_at": r[6].isoformat()} for r in cursor.fetchall()])


@api.get("/admin/users")
@_require_admin
def admin_users():
    with get_db_cursor() as cursor:
        cursor.execute("SELECT u.id, u.name, u.email, r.name, u.created_at FROM smartstock_users u JOIN smartstock_roles r ON r.id = u.role_id ORDER BY u.id")
        return jsonify([{"id": r[0], "name": r[1], "email": r[2], "role": r[3], "created_at": r[4].isoformat()} for r in cursor.fetchall()])


@api.put("/admin/users/<int:user_id>/role")
@_require_admin
def update_user_role(user_id: int):
    role = str((request.get_json(silent=True) or {}).get("role", "")).lower()
    if role not in {"admin", "user"}:
        return jsonify({"error": "Role must be admin or user"}), 400
    with get_db_cursor() as cursor:
        cursor.execute("UPDATE smartstock_users SET role_id = (SELECT id FROM smartstock_roles WHERE name = %s) WHERE id = %s", (role, user_id))
    return jsonify({"message": "Role updated"})


@api.get("/audit")
@_require_auth
def audit_report():
    with get_db_cursor() as cursor:
        cursor.execute("SELECT action, product_name, created_at FROM smartstock_inventory_history ORDER BY created_at DESC LIMIT 500")
        rows = [{"action": r[0], "product_name": r[1], "created_at": r[2].isoformat()} for r in cursor.fetchall()]
    return jsonify(rows)


def _report_rows() -> list[dict[str, Any]]:
    with get_db_cursor() as cursor:
        cursor.execute(PRODUCTS_QUERY)
        return [_product_from_row(row) for row in cursor.fetchall()]


@api.get("/exports/products.csv")
@_require_auth
def export_products_csv():
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=["id", "name", "quantity", "unit_price"])
    writer.writeheader()
    writer.writerows(_report_rows())
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=products.csv"})


@api.get("/exports/products.pdf")
@_require_auth
def export_products_pdf():
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle("SmartStock Product Report")
    pdf.drawString(50, 800, "SmartStock Product Report")
    y = 770
    for product in _report_rows():
        pdf.drawString(50, y, f"{product['id']}  {product['name'][:55]}  Qty: {product['quantity']}  Price: {product['unit_price']}")
        y -= 18
        if y < 50:
            pdf.showPage()
            y = 800
    pdf.save()
    buffer.seek(0)
    return send_file(buffer, mimetype="application/pdf", as_attachment=True, download_name="products.pdf")


@api.get("/exports/products.xlsx")
@_require_auth
def export_products_xlsx():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Products"
    sheet.append(["ID", "Name", "Quantity", "Unit Price"])
    for product in _report_rows():
        sheet.append([product["id"], product["name"], product["quantity"], product["unit_price"]])
    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return send_file(
        buffer,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name="products.xlsx",
    )


@api.get("/reports")
@_require_auth
def reports():
    with get_db_cursor() as cursor:
        cursor.execute(DASHBOARD_STATS_QUERY)
        stats = cursor.fetchone()
        cursor.execute(LOW_STOCK_QUERY)
        low_stock = cursor.fetchall()
    return jsonify({
        "total_products": stats[0],
        "total_stock_value": _json_value(stats[1]),
        "low_stock_count": stats[2],
        "low_stock_products": [_product_from_row(row) for row in low_stock],
    })


@api.get("/inventory-history")
@_require_auth
def inventory_history():
    with get_db_cursor() as cursor:
        cursor.execute(HISTORY_TABLE_QUERY)
        cursor.execute(
            """
            SELECT action, product_name, created_at
            FROM smartstock_inventory_history
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 100
            """,
            (session["user_id"],),
        )
        history = [
            {"action": row[0], "product_name": row[1], "created_at": row[2].isoformat()}
            for row in cursor.fetchall()
        ]
    return jsonify(history)


@api.post("/products")
@_require_auth
def create_product():
    """Create a product and its opening stock quantity in Odoo."""
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()

    try:
        quantity = float(data.get("quantity", 0))
        unit_price = float(data.get("unit_price", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Quantity and unit price must be numbers"}), 400

    if not name:
        return jsonify({"error": "Product name is required"}), 400
    if quantity < 0 or unit_price < 0:
        return jsonify({"error": "Quantity and unit price cannot be negative"}), 400

    with get_db_cursor() as cursor:
        cursor.execute(CREATE_PRODUCT_QUERY, (name, unit_price))
        template_id = cursor.fetchone()[0]
        cursor.execute(CREATE_VARIANT_QUERY, (template_id, unit_price))
        product_id = cursor.fetchone()[0]
        if quantity:
            cursor.execute(CREATE_QUANT_QUERY, (product_id, quantity))
        _record_history(cursor, "created", name)

    return jsonify({"message": "Product saved successfully", "product_id": product_id}), 201


@api.put("/products/<int:product_id>")
@_require_auth
def update_product(product_id: int):
    """Update an Odoo product and its current stock quantity."""
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    try:
        quantity = float(data.get("quantity", 0))
        unit_price = float(data.get("unit_price", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Quantity and unit price must be numbers"}), 400
    if not name:
        return jsonify({"error": "Product name is required"}), 400
    if quantity < 0 or unit_price < 0:
        return jsonify({"error": "Quantity and unit price cannot be negative"}), 400

    with get_db_cursor() as cursor:
        cursor.execute("SELECT product_tmpl_id FROM product_product WHERE id = %s", (product_id,))
        row = cursor.fetchone()
        if row is None:
            return jsonify({"error": "Product not found"}), 404
        template_id = row[0]
        cursor.execute(
            """
            UPDATE product_template
            SET name = jsonb_build_object('en_US', %s), list_price = %s, write_date = NOW()
            WHERE id = %s
            """,
            (name, unit_price, template_id),
        )
        cursor.execute(
            """
            UPDATE product_product
            SET standard_price = jsonb_build_object('en_US', %s), write_date = NOW()
            WHERE id = %s
            """,
            (unit_price, product_id),
        )
        cursor.execute("SELECT id FROM stock_quant WHERE product_id = %s LIMIT 1", (product_id,))
        quant = cursor.fetchone()
        if quant is None:
            cursor.execute(CREATE_QUANT_QUERY, (product_id, quantity))
        else:
            cursor.execute(
                "UPDATE stock_quant SET quantity = %s, write_date = NOW() WHERE product_id = %s",
                (quantity, product_id),
            )
        _record_history(cursor, "updated", name)
    return jsonify({"message": "Product updated successfully"})


@api.delete("/products/<int:product_id>")
@_require_auth
def delete_product(product_id: int):
    """Delete an Odoo product, its variant, and its stock quantities."""
    with get_db_cursor() as cursor:
        cursor.execute("SELECT product_tmpl_id FROM product_product WHERE id = %s", (product_id,))
        row = cursor.fetchone()
        if row is None:
            return jsonify({"error": "Product not found"}), 404
        template_id = row[0]
        cursor.execute("SELECT name FROM product_template WHERE id = %s", (template_id,))
        product_name = _product_name(cursor.fetchone()[0])
        cursor.execute("DELETE FROM stock_quant WHERE product_id = %s", (product_id,))
        cursor.execute("DELETE FROM product_product WHERE id = %s", (product_id,))
        cursor.execute("DELETE FROM product_template WHERE id = %s", (template_id,))
        _record_history(cursor, "deleted", product_name)
    return jsonify({"message": "Product deleted successfully"})


@api.get("/products")
@_require_auth
def get_products():
    """Return all Odoo products and their current stock quantities."""
    with get_db_cursor() as cursor:
        cursor.execute(PRODUCTS_QUERY)
        products = [_product_from_row(row) for row in cursor.fetchall()]
    return jsonify(products)


@api.get("/products/<int:product_id>")
@_require_auth
def get_product(product_id: int):
    with get_db_cursor() as cursor:
        cursor.execute(PRODUCTS_QUERY.replace("GROUP BY pp.id", "WHERE pp.id = %s GROUP BY pp.id"), (product_id,))
        row = cursor.fetchone()
        if row is None:
            return jsonify({"error": "Product not found"}), 404
        product = _product_from_row(row)
        cursor.execute(
            """
            SELECT COALESCE(AVG(rating), 0), COUNT(*)
            FROM smartstock_product_reviews
            WHERE product_id = %s
            """,
            (product_id,),
        )
        average, review_count = cursor.fetchone()
    product["average_rating"] = round(float(average), 2)
    product["review_count"] = review_count
    return jsonify(product)


@api.get("/products/<int:product_id>/reviews")
@_require_auth
def get_product_reviews(product_id: int):
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT r.id, r.rating, r.comment, r.created_at, u.name
            FROM smartstock_product_reviews r
            JOIN smartstock_users u ON u.id = r.user_id
            WHERE r.product_id = %s
            ORDER BY r.created_at DESC
            """,
            (product_id,),
        )
        reviews = [
            {
                "id": row[0],
                "rating": row[1],
                "comment": row[2],
                "created_at": row[3].isoformat(),
                "user_name": row[4],
            }
            for row in cursor.fetchall()
        ]
    return jsonify(reviews)


@api.post("/products/<int:product_id>/reviews")
@_require_auth
def create_product_review(product_id: int):
    data = request.get_json(silent=True) or {}
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        return jsonify({"error": "Rating must be a number from 1 to 5"}), 400
    comment = str(data.get("comment", "")).strip()
    if rating not in range(1, 6):
        return jsonify({"error": "Rating must be between 1 and 5"}), 400
    if not comment:
        return jsonify({"error": "Review comment is required"}), 400
    with get_db_cursor() as cursor:
        cursor.execute("SELECT id FROM product_product WHERE id = %s", (product_id,))
        if cursor.fetchone() is None:
            return jsonify({"error": "Product not found"}), 404
        cursor.execute(
            """
            INSERT INTO smartstock_product_reviews (product_id, user_id, rating, comment)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (product_id, session["user_id"], rating, comment),
        )
        review_id = cursor.fetchone()[0]
    return jsonify({"id": review_id, "message": "Review published successfully"}), 201


@api.get("/low-stock")
@_require_auth
def get_low_stock():
    """Return products with fewer than ten units in stock."""
    with get_db_cursor() as cursor:
        cursor.execute(LOW_STOCK_QUERY)
        products = [_product_from_row(row) for row in cursor.fetchall()]
    return jsonify(products)


@api.get("/dashboard-stats")
@_require_auth
def get_dashboard_stats():
    """Return the summary values used by the dashboard."""
    with get_db_cursor() as cursor:
        cursor.execute(DASHBOARD_STATS_QUERY)
        row = cursor.fetchone()

    return jsonify(
        {
            "total_products": row[0],
            "total_stock_value": _json_value(row[1]),
            "low_stock_count": row[2],
        }
    )
