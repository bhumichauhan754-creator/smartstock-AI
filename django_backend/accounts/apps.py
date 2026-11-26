"""Accounts app configuration."""

from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """Configuration for account and workspace models."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
