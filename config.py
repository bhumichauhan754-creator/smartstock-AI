"""Application configuration.

Update these values for the PostgreSQL database used by Odoo.
Set the environment variables before starting the application.
"""

import os


class Config:
    """Settings used by the Flask application."""

    SECRET_KEY = os.getenv("FLASK_SECRET_KEY")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "5432"))
    DB_NAME = os.getenv("DB_NAME", "odoo")
    DB_USER = os.getenv("DB_USER", "odoo")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DEBUG = os.getenv("FLASK_DEBUG", "false").lower() == "true"
