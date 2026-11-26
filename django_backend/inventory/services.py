"""Atomic inventory operations and workspace audit recording."""

from collections import defaultdict
from decimal import Decimal

from django import forms
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import QueryDict

from accounts.models import Workspace
from inventory.models import (
    AuditEvent,
    Product,
    PurchaseOrder,
    PurchaseOrderLine,
    SalesInvoice,
    SalesInvoiceLine,
    StockIssue,
    StockIssueLine,
    StockReceipt,
    StockReceiptLine,
)


def record_audit_event(
    workspace: Workspace,
    user,
    module: str,
    action: str,
    record: str,
    details: str,
) -> AuditEvent:
    return AuditEvent.objects.create(
        workspace=workspace,
        user=user,
        module=module,
        action=action,
        record=record[:120],
        details=details[:300],
    )


def parse_transaction_lines(
    data: QueryDict,
    workspace: Workspace,
    value_field: str,
) -> list[tuple[Product, Decimal, Decimal]]:
    product_ids = data.getlist("product_id")
    quantities = data.getlist("quantity")
    values = data.getlist(value_field)
    if not product_ids or len(product_ids) != len(quantities) or len(product_ids) != len(values):
        raise ValidationError("Add at least one complete product line.")
    if len(product_ids) > 100:
        raise ValidationError("A transaction can contain no more than 100 lines.")

    parsed_ids = []
    for product_id in product_ids:
        try:
            parsed_ids.append(int(product_id))
        except (TypeError, ValueError):
            raise ValidationError("Choose a valid product for every line.") from None

    products = {
        product.pk: product
        for product in Product.objects.filter(
            workspace=workspace,
            pk__in=set(parsed_ids),
        )
    }
    if len(products) != len(set(parsed_ids)):
        raise ValidationError("One or more selected products are not in this workspace.")

    quantity_field = forms.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal("0.001"),
    )
    value_form_field = forms.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
    )
    parsed_lines = []
    for product_id, quantity_value, unit_value in zip(
        parsed_ids,
        quantities,
        values,
        strict=True,
    ):
        try:
            quantity = quantity_field.clean(quantity_value)
            unit_value_decimal = value_form_field.clean(unit_value)
        except ValidationError as error:
            raise ValidationError("Enter a valid positive quantity and non-negative value.") from error
        parsed_lines.append(
            (products[product_id], quantity, unit_value_decimal)
        )
    return parsed_lines


def _lock_stock_products(
    workspace: Workspace,
    lines: list[tuple[Product, Decimal, Decimal]],
) -> dict[int, Product]:
    product_ids = {product.pk for product, _, _ in lines}
    products = {
        product.pk: product
        for product in Product.objects.select_for_update().filter(
            workspace=workspace,
            pk__in=product_ids,
        )
    }
    if len(products) != len(product_ids):
        raise ValidationError("One or more selected products are no longer available.")
    return products


def _validate_active_workspace_party(
    workspace: Workspace,
    cleaned_data: dict,
    field_name: str,
) -> None:
    party = cleaned_data.get(field_name)
    if (
        party is None
        or party.workspace_id != workspace.pk
        or not party.active
    ):
        raise ValidationError(
            f"Choose an active {field_name} from this workspace."
        )


@transaction.atomic
def create_stock_receipt(
    workspace: Workspace,
    user,
    cleaned_data: dict,
    lines: list[tuple[Product, Decimal, Decimal]],
) -> StockReceipt:
    _validate_active_workspace_party(workspace, cleaned_data, "supplier")
    products = _lock_stock_products(workspace, lines)
    receipt = StockReceipt.objects.create(
        workspace=workspace,
        created_by=user,
        **cleaned_data,
    )
    StockReceiptLine.objects.bulk_create(
        [
            StockReceiptLine(
                receipt=receipt,
                product=products[product.pk],
                quantity=quantity,
                unit_cost=unit_cost,
            )
            for product, quantity, unit_cost in lines
        ]
    )
    received_by_product: defaultdict[int, Decimal] = defaultdict(Decimal)
    for product, quantity, _ in lines:
        received_by_product[product.pk] += quantity
    for product_id, quantity in received_by_product.items():
        product = products[product_id]
        product.quantity += quantity
        product.save(update_fields=["quantity", "updated_at"])
    record_audit_event(
        workspace,
        user,
        "Stock",
        "stock",
        receipt.reference,
        f"Received stock for {len(lines)} product line(s).",
    )
    return receipt


@transaction.atomic
def create_stock_issue(
    workspace: Workspace,
    user,
    cleaned_data: dict,
    lines: list[tuple[Product, Decimal, Decimal]],
) -> StockIssue:
    products = _lock_stock_products(workspace, lines)
    issued_by_product: defaultdict[int, Decimal] = defaultdict(Decimal)
    for product, quantity, _ in lines:
        issued_by_product[product.pk] += quantity
    for product_id, quantity in issued_by_product.items():
        if products[product_id].quantity < quantity:
            raise ValidationError(
                f"Insufficient stock for {products[product_id].name}."
            )

    issue = StockIssue.objects.create(
        workspace=workspace,
        created_by=user,
        **cleaned_data,
    )
    StockIssueLine.objects.bulk_create(
        [
            StockIssueLine(
                issue=issue,
                product=products[product.pk],
                quantity=quantity,
                unit_value=unit_value,
            )
            for product, quantity, unit_value in lines
        ]
    )
    for product_id, quantity in issued_by_product.items():
        product = products[product_id]
        product.quantity -= quantity
        product.save(update_fields=["quantity", "updated_at"])
    record_audit_event(
        workspace,
        user,
        "Stock",
        "stock",
        issue.reference,
        f"Issued stock for {len(lines)} product line(s).",
    )
    return issue


@transaction.atomic
def create_purchase_order(
    workspace: Workspace,
    user,
    cleaned_data: dict,
    lines: list[tuple[Product, Decimal, Decimal]],
) -> PurchaseOrder:
    _validate_active_workspace_party(workspace, cleaned_data, "supplier")
    if any(product.workspace_id != workspace.pk for product, _, _ in lines):
        raise ValidationError("Choose products from this workspace.")
    order = PurchaseOrder.objects.create(
        workspace=workspace,
        created_by=user,
        **cleaned_data,
    )
    PurchaseOrderLine.objects.bulk_create(
        [
            PurchaseOrderLine(
                order=order,
                product=product,
                quantity=quantity,
                unit_cost=unit_cost,
            )
            for product, quantity, unit_cost in lines
        ]
    )
    record_audit_event(
        workspace,
        user,
        "Purchases",
        "created",
        order.reference,
        f"Created purchase order for {len(lines)} product line(s).",
    )
    return order


@transaction.atomic
def create_sales_invoice(
    workspace: Workspace,
    user,
    cleaned_data: dict,
    lines: list[tuple[Product, Decimal, Decimal]],
) -> SalesInvoice:
    _validate_active_workspace_party(workspace, cleaned_data, "customer")
    if any(product.workspace_id != workspace.pk for product, _, _ in lines):
        raise ValidationError("Choose products from this workspace.")
    invoice = SalesInvoice.objects.create(
        workspace=workspace,
        created_by=user,
        **cleaned_data,
    )
    SalesInvoiceLine.objects.bulk_create(
        [
            SalesInvoiceLine(
                invoice=invoice,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
            )
            for product, quantity, unit_price in lines
        ]
    )
    record_audit_event(
        workspace,
        user,
        "Sales",
        "created",
        invoice.reference,
        f"Created sales invoice for {len(lines)} product line(s).",
    )
    return invoice
