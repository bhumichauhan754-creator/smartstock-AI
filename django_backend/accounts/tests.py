"""Focused tests for account creation and authentication."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from accounts.models import UserProfile, Workspace
from inventory.models import Category


class RegistrationTests(TestCase):
    """Registration should create related account records atomically."""

    def test_registration_creates_user_profile_and_workspace(self) -> None:
        response = self.client.post(
            reverse("accounts:register"),
            {
                "full_name": "Asha Patel",
                "workspace_name": "North Hub",
                "email": "ASHA@example.com",
                "password1": "N0rth-Hub!2026",
                "password2": "N0rth-Hub!2026",
            },
        )

        self.assertRedirects(response, reverse("dashboard"))
        user_model = get_user_model()
        user = user_model.objects.get(username="asha@example.com")
        self.assertTrue(user.check_password("N0rth-Hub!2026"))
        self.assertEqual(user.get_full_name(), "Asha Patel")
        self.assertTrue(UserProfile.objects.filter(user=user).exists())
        self.assertTrue(Workspace.objects.filter(owner=user, name="North Hub").exists())
        self.assertEqual(
            Category.objects.filter(workspace__owner=user).count(),
            4,
        )
        self.assertIn("_auth_user_id", self.client.session)

    def test_registration_rejects_mismatched_passwords(self) -> None:
        response = self.client.post(
            reverse("accounts:register"),
            {
                "full_name": "Asha Patel",
                "workspace_name": "North Hub",
                "email": "asha@example.com",
                "password1": "N0rth-Hub!2026",
                "password2": "Different!2026",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertContains(response, "Please check your details", status_code=400)
        self.assertFalse(get_user_model().objects.filter(username="asha@example.com").exists())

    def test_registration_rejects_a_weak_password(self) -> None:
        response = self.client.post(
            reverse("accounts:register"),
            {
                "full_name": "Asha Patel",
                "workspace_name": "North Hub",
                "email": "asha@example.com",
                "password1": "password",
                "password2": "password",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(get_user_model().objects.filter(username="asha@example.com").exists())

    def test_registration_rejects_duplicate_email_case_insensitively(self) -> None:
        user_model = get_user_model()
        user_model.objects.create_user(
            username="asha@example.com",
            email="asha@example.com",
            password="Existing!2026",
        )

        response = self.client.post(
            reverse("accounts:register"),
            {
                "full_name": "Asha Patel",
                "workspace_name": "North Hub",
                "email": "ASHA@example.com",
                "password1": "N0rth-Hub!2026",
                "password2": "N0rth-Hub!2026",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(user_model.objects.count(), 1)


class AuthenticationTests(TestCase):
    """Login and protected template routes should use Django sessions."""

    def setUp(self) -> None:
        user_model = get_user_model()
        user = user_model.objects.create_user(
            username="member@example.com",
            email="member@example.com",
            password="Valid-Login!2026",
        )
        Workspace.objects.create(
            owner=user,
            name="Member Workspace",
            contact_email=user.email,
        )

    def test_login_accepts_email_and_password(self) -> None:
        response = self.client.post(
            reverse("accounts:login"),
            {"username": "MEMBER@example.com", "password": "Valid-Login!2026"},
        )

        self.assertRedirects(response, reverse("dashboard"))
        self.assertIn("_auth_user_id", self.client.session)

    def test_login_rejects_external_next_url(self) -> None:
        response = self.client.post(
            reverse("accounts:login"),
            {
                "username": "member@example.com",
                "password": "Valid-Login!2026",
                "next": "https://attacker.example/",
            },
        )

        self.assertRedirects(response, reverse("dashboard"))

    def test_invalid_login_returns_generic_error(self) -> None:
        response = self.client.post(
            reverse("accounts:login"),
            {"username": "member@example.com", "password": "incorrect"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Email or password is incorrect.")
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_dashboard_redirects_anonymous_users_to_login(self) -> None:
        response = self.client.get(reverse("dashboard"))

        self.assertRedirects(response, "/login/?next=/dashboard/")
