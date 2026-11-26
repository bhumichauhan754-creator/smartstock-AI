"""Account and workspace records managed by Django ORM."""

from django.conf import settings
from django.db import models


class Workspace(models.Model):
    """A SmartStock workspace owned by an authenticated user."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="smartstock_workspaces",
    )
    name = models.CharField(max_length=60)
    team_name = models.CharField(max_length=60, default="Inventory team")
    contact_email = models.EmailField()
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    low_stock_notifications = models.BooleanField(default=True)
    purchase_notifications = models.BooleanField(default=True)
    sales_notifications = models.BooleanField(default=True)
    weekly_summary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self) -> str:
        return self.name


class UserProfile(models.Model):
    """Optional SmartStock profile details for a Django user."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        STAFF = "staff", "Staff"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="smartstock_profile",
    )
    phone = models.CharField(max_length=30, blank=True)
    department = models.CharField(max_length=80, blank=True, default="Inventory Operations")
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    bio = models.CharField(max_length=240, blank=True)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.ADMIN)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.user.get_full_name() or self.user.get_username()
