"""Validated forms for inventory catalog changes."""

from django import forms
from django.core.exceptions import ValidationError
from django.core.files.base import File
from django.core.files.storage import default_storage
from django.db.models import Q

from accounts.models import Workspace
from inventory.models import (
    Category,
    Customer,
    Product,
    PurchaseOrder,
    SalesInvoice,
    StockIssue,
    StockReceipt,
    Supplier,
)


class CategoryForm(forms.ModelForm):
    def __init__(self, *args, workspace: Workspace, **kwargs) -> None:
        self.workspace = workspace
        super().__init__(*args, **kwargs)
        self.instance.workspace = workspace

    class Meta:
        model = Category
        fields = ["name", "description", "active"]

    def clean_name(self) -> str:
        name = self.cleaned_data["name"].strip()
        duplicates = Category.objects.filter(
            workspace=self.workspace,
            name__iexact=name,
        )
        if self.instance.pk:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise ValidationError("A category with this name already exists.")
        return name

    def save(self, commit: bool = True) -> Category:
        category = super().save(commit=False)
        category.workspace = self.workspace
        if commit:
            category.save()
            self.save_m2m()
        return category


class ProductForm(forms.ModelForm):
    category = forms.ModelChoiceField(
        queryset=Category.objects.none(),
        to_field_name="name",
    )

    def __init__(self, *args, workspace: Workspace, **kwargs) -> None:
        self.workspace = workspace
        instance = kwargs.get("instance")
        self._previous_image_name = (
            instance.image.name if instance and instance.image else ""
        )
        super().__init__(*args, **kwargs)
        self.instance.workspace = workspace
        categories = Category.objects.filter(workspace=workspace)
        if self.instance.pk:
            categories = categories.filter(
                Q(active=True) | Q(pk=self.instance.category_id)
            )
        else:
            categories = categories.filter(active=True)
        self.fields["category"].queryset = categories

    class Meta:
        model = Product
        fields = [
            "name",
            "sku",
            "category",
            "unit",
            "description",
            "purchase_price",
            "selling_price",
            "quantity",
            "minimum_stock",
            "image",
        ]

    def clean_name(self) -> str:
        return self.cleaned_data["name"].strip()

    def clean_sku(self) -> str:
        sku = self.cleaned_data["sku"].strip().upper()
        duplicate_skus = Product.objects.filter(
            workspace=self.workspace,
            sku__iexact=sku,
        )
        if self.instance.pk:
            duplicate_skus = duplicate_skus.exclude(pk=self.instance.pk)
        if duplicate_skus.exists():
            raise ValidationError("This SKU is already used in your workspace.")
        return sku

    def clean_image(self) -> File | None:
        image = self.cleaned_data.get("image")
        if image and image.name == self._previous_image_name:
            return image
        if image and image.size > 1024 * 1024:
            raise ValidationError("Choose an image smaller than 1 MB.")
        if image and getattr(image, "image", None):
            if image.image.format not in {"PNG", "JPEG", "WEBP"}:
                raise ValidationError("Choose a PNG, JPG, or WebP image.")
        return image

    def save(self, commit: bool = True) -> Product:
        product = super().save(commit=False)
        product.workspace = self.workspace
        if commit:
            product.save()
            self.save_m2m()
            if (
                self._previous_image_name
                and self._previous_image_name != product.image.name
            ):
                default_storage.delete(self._previous_image_name)
        return product


class DirectoryForm(forms.ModelForm):
    def __init__(self, *args, workspace: Workspace, **kwargs) -> None:
        self.workspace = workspace
        super().__init__(*args, **kwargs)
        self.instance.workspace = workspace

    def clean_name(self) -> str:
        name = self.cleaned_data["name"].strip()
        duplicates = self._meta.model.objects.filter(
            workspace=self.workspace,
            name__iexact=name,
        )
        if self.instance.pk:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise ValidationError("A record with this name already exists.")
        return name

    def clean_email(self) -> str:
        email = self.cleaned_data.get("email", "").strip().lower()
        if email:
            duplicates = self._meta.model.objects.filter(
                workspace=self.workspace,
                email__iexact=email,
            )
            if self.instance.pk:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise ValidationError("This email is already used in this workspace.")
        return email

    def save(self, commit: bool = True):
        record = super().save(commit=False)
        record.workspace = self.workspace
        if commit:
            record.save()
            self.save_m2m()
        return record


class SupplierForm(DirectoryForm):
    class Meta:
        model = Supplier
        fields = [
            "name",
            "contact_name",
            "email",
            "phone",
            "address",
            "notes",
            "active",
        ]


class CustomerForm(DirectoryForm):
    class Meta:
        model = Customer
        fields = [
            "name",
            "customer_type",
            "contact_name",
            "email",
            "phone",
            "address",
            "notes",
            "active",
        ]


class PurchaseOrderForm(forms.ModelForm):
    def __init__(self, *args, workspace: Workspace, **kwargs) -> None:
        self.workspace = workspace
        super().__init__(*args, **kwargs)
        self.fields["supplier"].queryset = Supplier.objects.filter(
            workspace=workspace,
            active=True,
        )

    class Meta:
        model = PurchaseOrder
        fields = ["reference", "supplier", "order_date", "expected_date", "notes"]
        widgets = {
            "order_date": forms.DateInput(attrs={"type": "date"}),
            "expected_date": forms.DateInput(attrs={"type": "date"}),
        }

    def clean_reference(self) -> str:
        reference = self.cleaned_data["reference"].strip()
        if PurchaseOrder.objects.filter(
            workspace=self.workspace,
            reference__iexact=reference,
        ).exists():
            raise ValidationError("This purchase order reference already exists.")
        return reference


class SalesInvoiceForm(forms.ModelForm):
    def __init__(self, *args, workspace: Workspace, **kwargs) -> None:
        self.workspace = workspace
        super().__init__(*args, **kwargs)
        self.fields["customer"].queryset = Customer.objects.filter(
            workspace=workspace,
            active=True,
        )

    class Meta:
        model = SalesInvoice
        fields = ["reference", "customer", "sale_date", "payment_status", "notes"]
        widgets = {"sale_date": forms.DateInput(attrs={"type": "date"})}

    def clean_reference(self) -> str:
        reference = self.cleaned_data["reference"].strip()
        if SalesInvoice.objects.filter(
            workspace=self.workspace,
            reference__iexact=reference,
        ).exists():
            raise ValidationError("This invoice reference already exists.")
        return reference

    def clean_payment_status(self) -> str:
        status = self.cleaned_data["payment_status"]
        if status not in {
            SalesInvoice.PaymentStatus.PENDING,
            SalesInvoice.PaymentStatus.PAID,
        }:
            raise ValidationError("New invoices must be pending or paid.")
        return status


class StockReceiptForm(forms.ModelForm):
    def __init__(self, *args, workspace: Workspace, **kwargs) -> None:
        self.workspace = workspace
        super().__init__(*args, **kwargs)
        self.fields["supplier"].queryset = Supplier.objects.filter(
            workspace=workspace,
            active=True,
        )

    class Meta:
        model = StockReceipt
        fields = ["reference", "received_date", "supplier", "supplier_invoice", "notes"]
        widgets = {"received_date": forms.DateInput(attrs={"type": "date"})}

    def clean_reference(self) -> str:
        reference = self.cleaned_data["reference"].strip()
        if StockReceipt.objects.filter(
            workspace=self.workspace,
            reference__iexact=reference,
        ).exists():
            raise ValidationError("This stock receipt reference already exists.")
        return reference


class StockIssueForm(forms.ModelForm):
    def __init__(self, *args, workspace: Workspace, **kwargs) -> None:
        self.workspace = workspace
        super().__init__(*args, **kwargs)

    class Meta:
        model = StockIssue
        fields = ["reference", "issue_date", "reason", "destination", "notes"]
        widgets = {"issue_date": forms.DateInput(attrs={"type": "date"})}

    def clean_reference(self) -> str:
        reference = self.cleaned_data["reference"].strip()
        if StockIssue.objects.filter(
            workspace=self.workspace,
            reference__iexact=reference,
        ).exists():
            raise ValidationError("This stock issue reference already exists.")
        return reference
