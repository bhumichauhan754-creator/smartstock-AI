"""Validated account forms for registration."""

from django import forms
from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError

from accounts.models import UserProfile, Workspace


TIMEZONE_CHOICES = (
    ("Asia/Kolkata", "India Standard Time (UTC+05:30)"),
    ("America/Los_Angeles", "Pacific Time"),
    ("America/New_York", "Eastern Time"),
    ("Europe/London", "United Kingdom Time"),
    ("UTC", "Coordinated Universal Time (UTC)"),
)

class RegistrationForm(forms.Form):
    """Validate the fields submitted by the frontend registration page."""

    full_name = forms.CharField(max_length=80)
    workspace_name = forms.CharField(max_length=60)
    email = forms.EmailField(max_length=120)
    password1 = forms.CharField(min_length=8, strip=False)
    password2 = forms.CharField(min_length=8, strip=False)

    def clean_email(self) -> str:
        email = self.cleaned_data["email"].strip().lower()
        user_model = get_user_model()
        if user_model.objects.filter(username__iexact=email).exists():
            raise ValidationError("An account with this email already exists.")
        return email

    def clean_password1(self) -> str:
        password = self.cleaned_data["password1"]
        email = self.cleaned_data.get("email", "")
        full_name = self.cleaned_data.get("full_name", "")
        user_model = get_user_model()
        name_parts = full_name.split()
        user = user_model(
            username=email,
            email=email,
            first_name=name_parts[0] if name_parts else "",
            last_name=" ".join(name_parts[1:]),
        )
        password_validation.validate_password(password, user=user)
        return password

    def clean(self) -> dict[str, object]:
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            self.add_error("password2", "Passwords do not match.")
        return cleaned_data


class ProfileForm(forms.Form):
    full_name = forms.CharField(max_length=80)
    email = forms.EmailField(max_length=120)
    phone = forms.CharField(max_length=30, required=False)
    department = forms.CharField(max_length=80, required=False)
    timezone = forms.ChoiceField(choices=TIMEZONE_CHOICES)
    bio = forms.CharField(max_length=240, required=False)

    def __init__(self, *args, user, profile: UserProfile, **kwargs) -> None:
        self.user = user
        self.profile = profile
        super().__init__(*args, **kwargs)
        if not self.is_bound:
            self.initial.update(
                {
                    "full_name": user.get_full_name(),
                    "email": user.email,
                    "phone": profile.phone,
                    "department": profile.department,
                    "timezone": profile.timezone,
                    "bio": profile.bio,
                }
            )
        initial_timezone = self.initial.get("timezone")
        if initial_timezone and initial_timezone not in dict(TIMEZONE_CHOICES):
            self.fields["timezone"].choices += (
                (initial_timezone, initial_timezone),
            )

    def clean_email(self) -> str:
        email = self.cleaned_data["email"].strip().lower()
        user_model = get_user_model()
        if user_model.objects.filter(username__iexact=email).exclude(
            pk=self.user.pk
        ).exists():
            raise ValidationError("This email is already used by another account.")
        return email

    def save(self) -> tuple[object, UserProfile]:
        name_parts = self.cleaned_data["full_name"].strip().split()
        self.user.first_name = name_parts[0] if name_parts else ""
        self.user.last_name = " ".join(name_parts[1:])
        self.user.email = self.cleaned_data["email"]
        self.user.username = self.cleaned_data["email"]
        self.user.save(update_fields=["first_name", "last_name", "email", "username"])

        self.profile.phone = self.cleaned_data["phone"].strip()
        self.profile.department = self.cleaned_data["department"].strip()
        self.profile.timezone = self.cleaned_data["timezone"]
        self.profile.bio = self.cleaned_data["bio"].strip()
        self.profile.save(
            update_fields=["phone", "department", "timezone", "bio"]
        )
        return self.user, self.profile


class WorkspaceSettingsForm(forms.ModelForm):
    workspace_name = forms.CharField(max_length=60)
    timezone = forms.ChoiceField(choices=TIMEZONE_CHOICES)

    class Meta:
        model = Workspace
        fields = [
            "team_name",
            "contact_email",
            "timezone",
            "low_stock_notifications",
            "purchase_notifications",
            "sales_notifications",
            "weekly_summary",
        ]

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.fields["workspace_name"].initial = self.instance.name
        if self.instance.timezone not in dict(TIMEZONE_CHOICES):
            self.fields["timezone"].choices += (
                (self.instance.timezone, self.instance.timezone),
            )

    def save(self, commit: bool = True) -> Workspace:
        workspace = super().save(commit=False)
        workspace.name = self.cleaned_data["workspace_name"].strip()
        if commit:
            workspace.save()
            self.save_m2m()
        return workspace
