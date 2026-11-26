"""Authentication views backed by Django's user and session systems."""

import logging
from datetime import timedelta

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError, transaction
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_http_methods, require_POST

from accounts.forms import ProfileForm, RegistrationForm, WorkspaceSettingsForm
from accounts.models import UserProfile, Workspace
from inventory.models import Category
from inventory.services import record_audit_event


logger = logging.getLogger(__name__)


def _form_error_message(form, fallback: str) -> str:
    errors = [
        f"{field.replace('_', ' ').title()}: {error}"
        for field, field_errors in form.errors.items()
        for error in field_errors
    ]
    return "; ".join(errors) or fallback


def login_view(request: HttpRequest) -> HttpResponse:
    """Authenticate users with their email and password."""
    if request.user.is_authenticated:
        return redirect("dashboard")

    server_error = ""
    next_url = request.POST.get("next", request.GET.get("next", ""))
    if request.method == "POST":
        email = request.POST.get("username", "").strip().lower()
        password = request.POST.get("password", "")
        user = authenticate(request, username=email, password=password)
        if user is not None:
            login(request, user)
            remember_user = request.POST.get("remember_me") == "on"
            request.session.set_expiry(timedelta(days=14) if remember_user else 0)
            if url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
                return redirect(next_url)
            return redirect("dashboard")
        server_error = "Email or password is incorrect."

    return render(
        request,
        "registration/login.html",
        {"demo": False, "server_error": server_error, "next": next_url},
    )


def register_view(request: HttpRequest) -> HttpResponse:
    """Create a Django user, profile, and initial workspace."""
    if request.user.is_authenticated:
        return redirect("dashboard")

    server_error = ""
    if request.method == "POST":
        form = RegistrationForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data["email"]
            full_name = form.cleaned_data["full_name"].strip()
            name_parts = full_name.split()
            user_model = get_user_model()

            try:
                with transaction.atomic():
                    user = user_model.objects.create_user(
                        username=email,
                        email=email,
                        password=form.cleaned_data["password1"],
                        first_name=name_parts[0],
                        last_name=" ".join(name_parts[1:]),
                    )
                    UserProfile.objects.create(user=user)
                    workspace = Workspace.objects.create(
                        owner=user,
                        name=form.cleaned_data["workspace_name"].strip(),
                        contact_email=email,
                    )
                    Category.objects.bulk_create(
                        [
                            Category(workspace=workspace, name=name)
                            for name in (
                                "Accessories",
                                "Electronics",
                                "Furniture",
                                "Office supplies",
                            )
                        ]
                    )
            except IntegrityError:
                logger.exception("Could not create a SmartStock account for the submitted email.")
                server_error = "We could not create that account. The email may already be registered."
            else:
                login(request, user)
                return redirect("dashboard")
        else:
            server_error = "Please check your details and choose a stronger matching password."

    return render(
        request,
        "registration/register.html",
        {"demo": False, "server_error": server_error},
        status=400 if server_error else 200,
    )


@require_POST
def logout_view(request: HttpRequest) -> HttpResponse:
    """End the authenticated session."""
    logout(request)
    return redirect("login")


@login_required
@require_http_methods(["GET", "POST"])
def profile_view(request: HttpRequest) -> HttpResponse:
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    workspace = get_object_or_404(Workspace, owner=request.user)
    form = ProfileForm(
        request.POST if request.method == "POST" else None,
        user=request.user,
        profile=profile,
    )
    server_error = ""
    if request.method == "POST":
        if form.is_valid():
            try:
                with transaction.atomic():
                    form.save()
                    record_audit_event(
                        workspace,
                        request.user,
                        "Profile",
                        "updated",
                        request.user.get_username(),
                        "Updated account profile details.",
                    )
            except IntegrityError:
                logger.exception("Could not save profile changes for user %s.", request.user.pk)
                server_error = "Those profile changes could not be saved."
            else:
                return redirect("profile")
        else:
            server_error = _form_error_message(
                form,
                "Please correct the profile details and try again.",
            )

    return render(
        request,
        "profile/index.html",
        {
            "demo": False,
            "form": form,
            "profile": profile,
            "workspace": workspace,
            "server_error": server_error,
            "user_role": profile.get_role_display(),
        },
        status=400 if server_error else 200,
    )


@login_required
@require_http_methods(["GET", "POST"])
def settings_view(request: HttpRequest) -> HttpResponse:
    workspace = get_object_or_404(Workspace, owner=request.user)
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    form = WorkspaceSettingsForm(
        request.POST if request.method == "POST" else None,
        instance=workspace,
    )
    server_error = ""
    if request.method == "POST":
        if form.is_valid():
            updated_workspace = form.save()
            record_audit_event(
                workspace,
                request.user,
                "Settings",
                "updated",
                updated_workspace.name,
                "Updated workspace settings and notification preferences.",
            )
            return redirect("settings")
        server_error = _form_error_message(
            form,
            "Please correct the workspace settings and try again.",
        )

    return render(
        request,
        "settings/index.html",
        {
            "demo": False,
            "form": form,
            "workspace": workspace,
            "server_error": server_error,
            "user_role": profile.get_role_display(),
        },
        status=400 if server_error else 200,
    )
