"""Entry point for the SmartStock AI Flask API."""

from flask import Flask, jsonify, send_from_directory
from psycopg2 import Error as PostgresError
from werkzeug.exceptions import HTTPException

from config import Config
from database import initialize_schema
from routes import api


def create_app() -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(Config)
    initialize_schema()
    app.register_blueprint(api)

    @app.get("/")
    def dashboard():
        """Serve the SmartStock AI dashboard."""
        return send_from_directory(app.root_path, "index.html")

    @app.get("/login")
    def login_page():
        """Serve the login page."""
        return send_from_directory(app.root_path, "login.html")

    @app.get("/signup")
    def signup_page():
        """Serve the signup page."""
        return send_from_directory(app.root_path, "signup.html")

    @app.get("/profile")
    def profile_page():
        return send_from_directory(app.root_path, "profile.html")

    @app.get("/products")
    def product_management_page():
        return send_from_directory(app.root_path, "product-management.html")

    @app.get("/product-details")
    def product_details_page():
        return send_from_directory(app.root_path, "product-details.html")

    @app.get("/reviews")
    def reviews_page():
        return send_from_directory(app.root_path, "reviews.html")

    @app.get("/history")
    def inventory_history_page():
        return send_from_directory(app.root_path, "inventory-history.html")

    @app.get("/reports")
    def reports_page():
        return send_from_directory(app.root_path, "reports.html")

    @app.get("/settings")
    def settings_page():
        return send_from_directory(app.root_path, "settings.html")

    @app.get("/categories")
    def categories_page():
        return send_from_directory(app.root_path, "categories.html")

    @app.get("/suppliers")
    def suppliers_page():
        return send_from_directory(app.root_path, "suppliers.html")

    @app.get("/customers")
    def customers_page():
        return send_from_directory(app.root_path, "customers.html")

    @app.get("/stock")
    def stock_page():
        return send_from_directory(app.root_path, "stock.html")

    @app.get("/admin")
    def admin_page():
        return send_from_directory(app.root_path, "admin.html")

    @app.get("/forgot-password")
    def forgot_password_page():
        return send_from_directory(app.root_path, "forgot-password.html")

    @app.get("/audit")
    def audit_page():
        return send_from_directory(app.root_path, "audit.html")

    @app.get("/purchase")
    def purchase_page():
        return send_from_directory(app.root_path, "purchase.html")

    @app.get("/sales")
    def sales_page():
        return send_from_directory(app.root_path, "sales.html")

    @app.errorhandler(Exception)
    def handle_unexpected_error(error: Exception):
        """Return JSON for unexpected server errors."""
        if isinstance(error, HTTPException):
            return jsonify({"error": error.description}), error.code
        app.logger.exception("Unexpected application error: %s", error)
        return jsonify({"error": "Internal server error"}), 500

    @app.errorhandler(PostgresError)
    def handle_database_error(error: PostgresError):
        """Return a clear JSON response when PostgreSQL rejects a request."""
        app.logger.exception("PostgreSQL request failed: %s", error)
        if getattr(error, "pgcode", None) == "42P01":
            message = (
                "The selected database does not contain Odoo tables. "
                "Create or select an Odoo database, then refresh this page."
            )
        else:
            message = (
                "Could not connect to the Odoo database. "
                "Check DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD."
            )
        return (
            jsonify({"error": message}),
            503,
        )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=app.config["DEBUG"])
