"""Admin registration for SmartStock account records."""

from django.contrib import admin

from accounts.models import UserProfile, Workspace


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    """Workspace records in Django admin."""

    list_display = ("name", "team_name", "owner", "contact_email", "created_at")
    search_fields = ("name", "team_name", "owner__email", "contact_email")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """User profile records in Django admin."""

    list_display = ("user", "role", "department", "timezone")
    list_filter = ("role",)
    search_fields = ("user__email", "user__first_name", "user__last_name")
