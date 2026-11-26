from django.contrib import admin

from inventory.models import (
    AuditEvent,
    Category,
    Customer,
    Product,
    PurchaseOrder,
    PurchaseOrderLine,
    SalesInvoice,
    SalesInvoiceLine,
    StockIssue,
    StockIssueLine,
    StockReceipt,
    StockReceiptLine,
    Supplier,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "workspace", "active", "created_at")
    list_filter = ("active",)
    search_fields = ("name", "workspace__name")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "sku",
        "category",
        "workspace",
        "quantity",
        "minimum_stock",
    )
    list_filter = ("category", "unit")
    search_fields = ("name", "sku")


admin.site.register(
    [
        Supplier,
        Customer,
        PurchaseOrder,
        PurchaseOrderLine,
        SalesInvoice,
        SalesInvoiceLine,
        StockReceipt,
        StockReceiptLine,
        StockIssue,
        StockIssueLine,
        AuditEvent,
    ]
)
