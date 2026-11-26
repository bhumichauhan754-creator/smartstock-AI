"""Workspace-scoped inventory catalog models."""

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.conf import settings
from django.db import models
from django.db.models import F
from django.db.models.functions import Lower

from accounts.models import Workspace


class Category(models.Model):
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    name = models.CharField(max_length=80)
    description = models.CharField(max_length=300, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                F("workspace"),
                name="inventory_category_workspace_name_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    class Unit(models.TextChoices):
        UNITS = "Units", "Units"
        BOXES = "Boxes", "Boxes"
        PAIRS = "Pairs", "Pairs"
        KILOGRAMS = "Kg", "Kilograms (kg)"
        LITRES = "Litres", "Litres"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="products",
    )
    name = models.CharField(max_length=120)
    sku = models.CharField(max_length=40)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    description = models.CharField(max_length=300, blank=True)
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    selling_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=0,
        validators=[MinValueValidator(0)],
    )
    minimum_stock = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=0,
        validators=[MinValueValidator(0)],
    )
    unit = models.CharField(max_length=12, choices=Unit.choices, default=Unit.UNITS)
    image = models.ImageField(upload_to="products/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                Lower("sku"),
                F("workspace"),
                name="inventory_product_workspace_sku_ci_uniq",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        if self.category_id and self.workspace_id:
            if self.category.workspace_id != self.workspace_id:
                raise ValidationError(
                    {"category": "Choose a category from this workspace."}
                )

    def __str__(self) -> str:
        return f"{self.name} ({self.sku})"

    @property
    def stock_status(self) -> str:
        if self.quantity <= 0:
            return "out-of-stock"
        if self.quantity < self.minimum_stock:
            return "low-stock"
        return "in-stock"

    @property
    def stock_status_label(self) -> str:
        return {
            "out-of-stock": "Out of stock",
            "low-stock": "Low stock",
            "in-stock": "In stock",
        }[self.stock_status]


class DirectoryRecord(models.Model):
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="+",
    )
    name = models.CharField(max_length=80)
    contact_name = models.CharField(max_length=80)
    email = models.EmailField(max_length=120, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=160, blank=True)
    notes = models.CharField(max_length=240, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Supplier(DirectoryRecord):
    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                F("workspace"),
                name="inventory_supplier_workspace_name_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class Customer(DirectoryRecord):
    class Type(models.TextChoices):
        BUSINESS = "Business", "Business"
        INDIVIDUAL = "Individual", "Individual"

    customer_type = models.CharField(
        max_length=12,
        choices=Type.choices,
        default=Type.BUSINESS,
    )

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                F("workspace"),
                name="inventory_customer_workspace_name_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class PurchaseOrder(models.Model):
    class Status(models.TextChoices):
        DRAFT = "Draft", "Draft"
        ORDERED = "Ordered", "Ordered"
        RECEIVED = "Received", "Received"
        CANCELLED = "Cancelled", "Cancelled"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="purchase_orders",
    )
    reference = models.CharField(max_length=40)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="purchase_orders",
    )
    order_date = models.DateField()
    expected_date = models.DateField(null=True, blank=True)
    received_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.ORDERED,
    )
    supplier_invoice = models.CharField(max_length=50, blank=True)
    notes = models.CharField(max_length=240, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-order_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                Lower("reference"),
                F("workspace"),
                name="inventory_purchase_workspace_ref_ci_uniq",
            ),
        ]

    @property
    def total(self):
        return sum(
            (line.quantity * line.unit_cost for line in self.lines.all()),
            start=0,
        )

    def __str__(self) -> str:
        return self.reference


class PurchaseOrderLine(models.Model):
    order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="purchase_lines",
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(0.001)],
    )
    unit_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )

    @property
    def subtotal(self):
        return self.quantity * self.unit_cost


class SalesInvoice(models.Model):
    class PaymentStatus(models.TextChoices):
        PENDING = "Pending", "Pending"
        PAID = "Paid", "Paid"
        CANCELLED = "Cancelled", "Cancelled"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="sales_invoices",
    )
    reference = models.CharField(max_length=40)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="sales_invoices",
    )
    sale_date = models.DateField()
    payment_status = models.CharField(
        max_length=12,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
    )
    notes = models.CharField(max_length=240, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-sale_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                Lower("reference"),
                F("workspace"),
                name="inventory_sale_workspace_ref_ci_uniq",
            ),
        ]

    @property
    def total(self):
        return sum(
            (line.quantity * line.unit_price for line in self.lines.all()),
            start=0,
        )

    def __str__(self) -> str:
        return self.reference


class SalesInvoiceLine(models.Model):
    invoice = models.ForeignKey(
        SalesInvoice,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="sale_lines",
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(0.001)],
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )

    @property
    def subtotal(self):
        return self.quantity * self.unit_price


class StockReceipt(models.Model):
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="stock_receipts",
    )
    reference = models.CharField(max_length=40)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name="stock_receipts",
    )
    received_date = models.DateField()
    supplier_invoice = models.CharField(max_length=50, blank=True)
    notes = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                Lower("reference"),
                F("workspace"),
                name="inventory_receipt_workspace_ref_ci_uniq",
            ),
        ]

    @property
    def total(self):
        return sum(
            (line.quantity * line.unit_cost for line in self.lines.all()),
            start=0,
        )

    def __str__(self) -> str:
        return self.reference


class StockReceiptLine(models.Model):
    receipt = models.ForeignKey(
        StockReceipt,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="receipt_lines",
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(0.001)],
    )
    unit_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )


class StockIssue(models.Model):
    class Reason(models.TextChoices):
        CUSTOMER_SALE = "Customer sale", "Customer sale"
        DAMAGED = "Damaged or written off", "Damaged or written off"
        INTERNAL_USE = "Internal use", "Internal use"
        RETURN_SUPPLIER = "Return to supplier", "Return to supplier"
        OTHER = "Other", "Other"

    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="stock_issues",
    )
    reference = models.CharField(max_length=40)
    issue_date = models.DateField()
    reason = models.CharField(max_length=32, choices=Reason.choices)
    destination = models.CharField(max_length=80, blank=True)
    notes = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-issue_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                Lower("reference"),
                F("workspace"),
                name="inventory_issue_workspace_ref_ci_uniq",
            ),
        ]

    @property
    def total(self):
        return sum(
            (line.quantity * line.unit_value for line in self.lines.all()),
            start=0,
        )

    def __str__(self) -> str:
        return self.reference


class StockIssueLine(models.Model):
    issue = models.ForeignKey(
        StockIssue,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="issue_lines",
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        validators=[MinValueValidator(0.001)],
    )
    unit_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
    )


class AuditEvent(models.Model):
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="audit_events",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
    )
    module = models.CharField(max_length=30)
    action = models.CharField(max_length=20)
    record = models.CharField(max_length=120)
    details = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
