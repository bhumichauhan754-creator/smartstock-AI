"""Authenticated product management views."""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncMonth
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from accounts.models import UserProfile, Workspace
from inventory.forms import (
    CategoryForm,
    CustomerForm,
    ProductForm,
    PurchaseOrderForm,
    SalesInvoiceForm,
    StockIssueForm,
    StockReceiptForm,
    SupplierForm,
)
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
from inventory.services import (
    create_purchase_order,
    create_sales_invoice,
    create_stock_issue,
    create_stock_receipt,
    parse_transaction_lines,
    record_audit_event,
)


def _workspace_for_user(request: HttpRequest) -> Workspace:
    return get_object_or_404(Workspace, owner=request.user)


def _form_error_message(form, fallback: str) -> str:
    errors = [
        f"{field.replace('_', ' ').title()}: {error}"
        for field, field_errors in form.errors.items()
        for error in field_errors
    ]
    return "; ".join(errors) or fallback


@login_required
def dashboard_view(request: HttpRequest) -> HttpResponse:
    workspace = _workspace_for_user(request)
    products = Product.objects.filter(workspace=workspace)
    stock_total = products.aggregate(total=Sum("quantity"))["total"] or Decimal("0")
    sales_total = SalesInvoiceLine.objects.filter(
        invoice__workspace=workspace,
    ).exclude(
        invoice__payment_status=SalesInvoice.PaymentStatus.CANCELLED,
    ).aggregate(
        total=Sum(F("quantity") * F("unit_price")),
    )["total"] or Decimal("0")
    purchases_total = PurchaseOrderLine.objects.filter(
        order__workspace=workspace,
    ).exclude(
        order__status=PurchaseOrder.Status.CANCELLED,
    ).aggregate(
        total=Sum(F("quantity") * F("unit_cost")),
    )["total"] or Decimal("0")

    today = timezone.localdate()
    month_index = today.year * 12 + today.month - 1
    month_starts = [
        date((month_index + offset) // 12, (month_index + offset) % 12 + 1, 1)
        for offset in range(-5, 1)
    ]
    next_month = date(
        (month_index + 1) // 12,
        (month_index + 1) % 12 + 1,
        1,
    )
    receipt_totals = {
        row["month"].strftime("%Y-%m"): float(row["total"] or 0)
        for row in StockReceiptLine.objects.filter(
            receipt__workspace=workspace,
            receipt__received_date__gte=month_starts[0],
            receipt__received_date__lt=next_month,
        ).annotate(
            month=TruncMonth("receipt__received_date"),
        ).values("month").annotate(
            total=Sum("quantity"),
        )
    }
    issue_totals = {
        row["month"].strftime("%Y-%m"): float(row["total"] or 0)
        for row in StockIssueLine.objects.filter(
            issue__workspace=workspace,
            issue__issue_date__gte=month_starts[0],
            issue__issue_date__lt=next_month,
        ).annotate(
            month=TruncMonth("issue__issue_date"),
        ).values("month").annotate(
            total=Sum("quantity"),
        )
    }
    chart_data = {
        period: {
            "labels": [month.strftime("%b") for month in month_starts[-period:]],
            "received": [
                receipt_totals.get(month.strftime("%Y-%m"), 0)
                for month in month_starts[-period:]
            ],
            "dispatched": [
                issue_totals.get(month.strftime("%Y-%m"), 0)
                for month in month_starts[-period:]
            ],
        }
        for period in (3, 6)
    }
    category_rows = list(
        Category.objects.filter(workspace=workspace)
        .annotate(stock_total=Sum("products__quantity"))
        .order_by("-stock_total", "name")[:4]
    )
    max_category_stock = max(
        (category.stock_total or Decimal("0") for category in category_rows),
        default=Decimal("0"),
    )
    category_colors = ("electronics", "accessories", "office", "furniture")
    category_data = []
    for index, category in enumerate(category_rows):
        quantity = category.stock_total or Decimal("0")
        category_data.append(
            {
                "name": category.name,
                "quantity": quantity,
                "percentage": (
                    round(float(quantity / max_category_stock * 100))
                    if max_category_stock
                    else 0
                ),
                "color": category_colors[index % len(category_colors)],
            }
        )
    activities = []
    for event in AuditEvent.objects.filter(workspace=workspace).select_related(
        "user"
    )[:5]:
        user_name = (
            event.user.get_full_name() or event.user.get_username()
            if event.user
            else "System"
        )
        activities.append(
            {
                "module": event.module,
                "action": event.action,
                "label": f"{event.action.title()} {event.module.lower()}",
                "record": event.record,
                "details": event.details,
                "user": user_name,
                "timestamp": event.created_at,
                "status": "Completed" if event.action == "stock" else "Recorded",
                "status_class": "complete" if event.action == "stock" else "processing",
                "type": "in" if event.module == "Stock" else "out",
                "search": " ".join(
                    (event.module, event.action, event.record, event.details, user_name)
                ).lower(),
            }
        )

    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    return render(
        request,
        "dashboard/index.html",
        {
            "demo": False,
            "workspace": workspace,
            "profile": profile,
            "user_role": profile.get_role_display(),
            "today": today,
            "total_products": products.count(),
            "total_stock": stock_total,
            "low_stock_products": products.filter(
                quantity__gt=0,
                quantity__lt=F("minimum_stock"),
            ).count(),
            "total_sales": sales_total,
            "total_purchases": purchases_total,
            "category_data": category_data,
            "category_stock_total": stock_total,
            "chart_data": chart_data,
            "activities": activities,
        },
    )


@login_required
def reports_view(request: HttpRequest) -> HttpResponse:
    workspace = _workspace_for_user(request)
    products = Product.objects.filter(workspace=workspace).select_related("category")
    product_data = [_product_payload(product) for product in products]
    return render(
        request,
        "reports/index.html",
        {
            "demo": False,
            "workspace": workspace,
            "product_data": product_data,
            "category_names": list(
                Category.objects.filter(workspace=workspace).values_list(
                    "name",
                    flat=True,
                )
            ),
        },
    )


@login_required
def audit_view(request: HttpRequest) -> HttpResponse:
    workspace = _workspace_for_user(request)
    events = AuditEvent.objects.filter(workspace=workspace).select_related("user")
    action_labels = {
        "created": "Record created",
        "updated": "Record updated",
        "deleted": "Record deleted",
        "status": "Status changed",
        "stock": "Stock movement",
        "archived": "Record archived",
    }
    audit_data = []
    for event in events:
        user_name = (
            event.user.get_full_name() or event.user.get_username()
            if event.user
            else "System"
        )
        initials = "".join(
            part[0].upper() for part in user_name.split()[:2]
        ) or "SY"
        audit_data.append(
            {
                "timestamp": event.created_at.isoformat(),
                "user": user_name,
                "initials": initials,
                "avatar": "blue" if event.user_id else "grey",
                "action": event.action,
                "actionLabel": action_labels.get(event.action, event.action.title()),
                "module": event.module,
                "record": event.record,
                "reference": "",
                "details": event.details,
            }
        )
    return render(
        request,
        "audit/index.html",
        {
            "demo": False,
            "workspace": workspace,
            "audit_data": audit_data,
            "total_events": events.count(),
        },
    )


def _product_form_context(form: ProductForm, server_error: str) -> dict[str, object]:
    return {
        "demo": False,
        "form": form,
        "categories": form.fields["category"].queryset,
        "server_error": server_error,
    }


def _categories_page(
    request: HttpRequest,
    server_error: str = "",
    status: int = 200,
    category_form: CategoryForm | None = None,
) -> HttpResponse:
    workspace = _workspace_for_user(request)
    categories = Category.objects.filter(workspace=workspace).annotate(
        product_count=Count("products")
    )
    return render(
        request,
        "categories/index.html",
        {
            "demo": False,
            "categories": categories,
            "total_categories": categories.count(),
            "active_categories": categories.filter(active=True).count(),
            "archived_categories": categories.filter(active=False).count(),
            "categorized_products": Product.objects.filter(workspace=workspace).count(),
            "server_error": server_error,
            "category_form": category_form,
        },
        status=status,
    )


@login_required
def categories_view(request: HttpRequest) -> HttpResponse:
    return _categories_page(request)


@login_required
@require_POST
def add_category_view(request: HttpRequest) -> HttpResponse:
    form = CategoryForm(request.POST, workspace=_workspace_for_user(request))
    if form.is_valid():
        category = form.save()
        record_audit_event(
            category.workspace,
            request.user,
            "Categories",
            "created",
            category.name,
            "Created a category.",
        )
        return redirect("categories")
    return _categories_page(
        request,
        "Please correct the category details and try again.",
        status=400,
        category_form=form,
    )


@login_required
@require_POST
def edit_category_view(request: HttpRequest, category_id: int) -> HttpResponse:
    workspace = _workspace_for_user(request)
    category = get_object_or_404(Category, pk=category_id, workspace=workspace)
    form = CategoryForm(
        request.POST,
        instance=category,
        workspace=workspace,
    )
    if form.is_valid():
        category = form.save()
        record_audit_event(
            workspace,
            request.user,
            "Categories",
            "updated",
            category.name,
            "Updated category details or active status.",
        )
        return redirect("categories")
    return _categories_page(
        request,
        "Please correct the category details and try again.",
        status=400,
        category_form=form,
    )


@login_required
@require_POST
def delete_category_view(request: HttpRequest, category_id: int) -> HttpResponse:
    workspace = _workspace_for_user(request)
    category = get_object_or_404(Category, pk=category_id, workspace=workspace)
    if category.products.exists():
        return _categories_page(
            request,
            "Categories assigned to products cannot be deleted. Archive the category instead.",
            status=409,
        )
    category.delete()
    record_audit_event(
        workspace,
        request.user,
        "Categories",
        "deleted",
        category.name,
        "Deleted an unused category.",
    )
    return redirect("categories")


@login_required
def products_view(
    request: HttpRequest,
    server_error: str = "",
    status: int = 200,
) -> HttpResponse:
    workspace = _workspace_for_user(request)
    products = Product.objects.filter(workspace=workspace).select_related("category")
    categories = Category.objects.filter(workspace=workspace)
    total_products = products.count()
    out_of_stock_count = products.filter(quantity__lte=0).count()
    low_stock_count = products.filter(
        quantity__gt=0,
        quantity__lt=F("minimum_stock"),
    ).count()

    return render(
        request,
        "products/index.html",
        {
            "demo": False,
            "products": products,
            "categories": categories,
            "total_products": total_products,
            "out_of_stock_count": out_of_stock_count,
            "low_stock_count": low_stock_count,
            "in_stock_count": total_products - out_of_stock_count - low_stock_count,
            "server_error": server_error,
        },
        status=status,
    )


@login_required
def add_product_view(request: HttpRequest) -> HttpResponse:
    workspace = _workspace_for_user(request)
    form = ProductForm(
        request.POST if request.method == "POST" else None,
        request.FILES if request.method == "POST" else None,
        workspace=workspace,
    )
    server_error = ""
    if request.method == "POST":
        if form.is_valid():
            product = form.save()
            record_audit_event(
                workspace,
                request.user,
                "Products",
                "created",
                product.sku,
                f"Created product {product.name}.",
            )
            return redirect("products")
        server_error = "Please correct the product details and try again."

    return render(
        request,
        "products/add.html",
        _product_form_context(form, server_error),
        status=400 if server_error else 200,
    )


@login_required
def edit_product_view(request: HttpRequest, product_id: int) -> HttpResponse:
    workspace = _workspace_for_user(request)
    product = get_object_or_404(Product, pk=product_id, workspace=workspace)
    form = ProductForm(
        request.POST if request.method == "POST" else None,
        request.FILES if request.method == "POST" else None,
        instance=product,
        workspace=workspace,
    )
    server_error = ""
    if request.method == "POST":
        if form.is_valid():
            product = form.save()
            if request.POST.get("clear_image") == "true" and product.image:
                product.image.delete(save=False)
                product.image = ""
                product.save(update_fields=["image", "updated_at"])
            record_audit_event(
                workspace,
                request.user,
                "Products",
                "updated",
                product.sku,
                f"Updated product {product.name}.",
            )
            return redirect("products")
        server_error = "Please correct the product details and try again."

    return render(
        request,
        "products/edit.html",
        {
            **_product_form_context(form, server_error),
            "product": product,
        },
        status=400 if server_error else 200,
    )


@login_required
@require_POST
def delete_product_view(request: HttpRequest, product_id: int) -> HttpResponse:
    workspace = _workspace_for_user(request)
    product = get_object_or_404(Product, pk=product_id, workspace=workspace)
    if (
        product.purchase_lines.exists()
        or product.sale_lines.exists()
        or product.receipt_lines.exists()
        or product.issue_lines.exists()
    ):
        return products_view(
            request,
            "Products with transaction history cannot be deleted.",
            status=409,
        )
    product_name = product.name
    product_sku = product.sku
    if product.image:
        product.image.delete(save=False)
    product.delete()
    record_audit_event(
        workspace,
        request.user,
        "Products",
        "deleted",
        product_sku,
        f"Deleted product {product_name}.",
    )
    return redirect("products")


def _supplier_payload(supplier: Supplier) -> dict[str, object]:
    return {
        "id": str(supplier.pk),
        "name": supplier.name,
        "contactName": supplier.contact_name,
        "email": supplier.email,
        "phone": supplier.phone,
        "address": supplier.address,
        "notes": supplier.notes,
        "isActive": supplier.active,
    }


def _customer_payload(customer: Customer) -> dict[str, object]:
    return {
        "id": str(customer.pk),
        "name": customer.name,
        "customerType": customer.customer_type,
        "contactName": customer.contact_name,
        "email": customer.email,
        "phone": customer.phone,
        "address": customer.address,
        "notes": customer.notes,
        "isActive": customer.active,
    }


def _supplier_page(
    request: HttpRequest,
    server_error: str = "",
    status: int = 200,
) -> HttpResponse:
    workspace = _workspace_for_user(request)
    suppliers = Supplier.objects.filter(workspace=workspace)
    purchases = PurchaseOrder.objects.filter(workspace=workspace).select_related(
        "supplier"
    )
    receipts = StockReceipt.objects.filter(workspace=workspace).select_related(
        "supplier"
    )
    return render(
        request,
        "suppliers/index.html",
        {
            "demo": False,
            "suppliers": [_supplier_payload(supplier) for supplier in suppliers],
            "purchase_data": [
                {"supplier": order.supplier.name, "status": order.status}
                for order in purchases
            ],
            "receipt_data": [
                {"supplier": receipt.supplier.name}
                for receipt in receipts
            ],
            "total_suppliers": suppliers.count(),
            "active_suppliers": suppliers.filter(active=True).count(),
            "open_supplier_orders": purchases.filter(
                status__in=[PurchaseOrder.Status.DRAFT, PurchaseOrder.Status.ORDERED]
            ).count(),
            "archived_suppliers": suppliers.filter(active=False).count(),
            "server_error": server_error,
        },
        status=status,
    )


@login_required
def suppliers_view(request: HttpRequest) -> HttpResponse:
    return _supplier_page(request)


@login_required
@require_POST
def add_supplier_view(request: HttpRequest) -> HttpResponse:
    workspace = _workspace_for_user(request)
    form = SupplierForm(request.POST, workspace=workspace)
    if form.is_valid():
        supplier = form.save()
        record_audit_event(
            workspace,
            request.user,
            "Suppliers",
            "created",
            supplier.name,
            "Added a supplier to the directory.",
        )
        return redirect("suppliers")
    return _supplier_page(
        request,
        _form_error_message(form, "Please correct the supplier details and try again."),
        status=400,
    )


@login_required
@require_POST
def edit_supplier_view(request: HttpRequest, supplier_id: int) -> HttpResponse:
    workspace = _workspace_for_user(request)
    supplier = get_object_or_404(Supplier, pk=supplier_id, workspace=workspace)
    form = SupplierForm(request.POST, instance=supplier, workspace=workspace)
    has_history = supplier.purchase_orders.exists() or supplier.stock_receipts.exists()
    if form.is_valid():
        if has_history and form.cleaned_data["name"] != supplier.name:
            form.add_error(
                "name",
                "The supplier name cannot change while purchase or receipt history is linked.",
            )
        else:
            supplier = form.save()
            record_audit_event(
                workspace,
                request.user,
                "Suppliers",
                "updated",
                supplier.name,
                "Updated supplier details.",
            )
            return redirect("suppliers")
    return _supplier_page(
        request,
        _form_error_message(form, "Please correct the supplier details and try again."),
        status=400,
    )


@login_required
@require_POST
def supplier_status_view(request: HttpRequest, supplier_id: int) -> HttpResponse:
    workspace = _workspace_for_user(request)
    supplier = get_object_or_404(Supplier, pk=supplier_id, workspace=workspace)
    supplier.active = request.POST.get("active") == "true"
    supplier.save(update_fields=["active", "updated_at"])
    record_audit_event(
        workspace,
        request.user,
        "Suppliers",
        "archived" if not supplier.active else "status",
        supplier.name,
        "Changed supplier active status.",
    )
    return redirect("suppliers")


@login_required
@require_POST
def delete_supplier_view(request: HttpRequest, supplier_id: int) -> HttpResponse:
    workspace = _workspace_for_user(request)
    supplier = get_object_or_404(Supplier, pk=supplier_id, workspace=workspace)
    if supplier.purchase_orders.exists() or supplier.stock_receipts.exists():
        return _supplier_page(
            request,
            "Suppliers with purchase or receipt history cannot be deleted. Archive the supplier instead.",
            status=409,
        )
    name = supplier.name
    supplier.delete()
    record_audit_event(
        workspace,
        request.user,
        "Suppliers",
        "deleted",
        name,
        "Deleted an unused supplier.",
    )
    return redirect("suppliers")


def _customer_page(
    request: HttpRequest,
    server_error: str = "",
    status: int = 200,
) -> HttpResponse:
    workspace = _workspace_for_user(request)
    customers = Customer.objects.filter(workspace=workspace)
    sales = SalesInvoice.objects.filter(workspace=workspace).select_related(
        "customer"
    ).prefetch_related("lines")
    return render(
        request,
        "customers/index.html",
        {
            "demo": False,
            "customers": [_customer_payload(customer) for customer in customers],
            "sales_data": [
                {
                    "customer": invoice.customer.name,
                    "paymentStatus": invoice.payment_status,
                    "total": float(invoice.total),
                }
                for invoice in sales
            ],
            "total_customers": customers.count(),
            "active_customers": customers.filter(active=True).count(),
            "open_customer_invoices": sales.filter(
                payment_status=SalesInvoice.PaymentStatus.PENDING
            ).count(),
            "archived_customers": customers.filter(active=False).count(),
            "server_error": server_error,
        },
        status=status,
    )


@login_required
def customers_view(request: HttpRequest) -> HttpResponse:
    return _customer_page(request)


@login_required
@require_POST
def add_customer_view(request: HttpRequest) -> HttpResponse:
    workspace = _workspace_for_user(request)
    form = CustomerForm(request.POST, workspace=workspace)
    if form.is_valid():
        customer = form.save()
        record_audit_event(
            workspace,
            request.user,
            "Customers",
            "created",
            customer.name,
            "Added a customer to the directory.",
        )
        return redirect("customers")
    return _customer_page(
        request,
        _form_error_message(form, "Please correct the customer details and try again."),
        status=400,
    )


@login_required
@require_POST
def edit_customer_view(request: HttpRequest, customer_id: int) -> HttpResponse:
    workspace = _workspace_for_user(request)
    customer = get_object_or_404(Customer, pk=customer_id, workspace=workspace)
    form = CustomerForm(request.POST, instance=customer, workspace=workspace)
    has_history = customer.sales_invoices.exists()
    if form.is_valid():
        if has_history and form.cleaned_data["name"] != customer.name:
            form.add_error(
                "name",
                "The customer name cannot change while invoice history is linked.",
            )
        else:
            customer = form.save()
            record_audit_event(
                workspace,
                request.user,
                "Customers",
                "updated",
                customer.name,
                "Updated customer details.",
            )
            return redirect("customers")
    return _customer_page(
        request,
        _form_error_message(form, "Please correct the customer details and try again."),
        status=400,
    )


@login_required
@require_POST
def customer_status_view(request: HttpRequest, customer_id: int) -> HttpResponse:
    workspace = _workspace_for_user(request)
    customer = get_object_or_404(Customer, pk=customer_id, workspace=workspace)
    customer.active = request.POST.get("active") == "true"
    customer.save(update_fields=["active", "updated_at"])
    record_audit_event(
        workspace,
        request.user,
        "Customers",
        "archived" if not customer.active else "status",
        customer.name,
        "Changed customer active status.",
    )
    return redirect("customers")


@login_required
@require_POST
def delete_customer_view(request: HttpRequest, customer_id: int) -> HttpResponse:
    workspace = _workspace_for_user(request)
    customer = get_object_or_404(Customer, pk=customer_id, workspace=workspace)
    if customer.sales_invoices.exists():
        return _customer_page(
            request,
            "Customers with invoice history cannot be deleted. Archive the customer instead.",
            status=409,
        )
    name = customer.name
    customer.delete()
    record_audit_event(
        workspace,
        request.user,
        "Customers",
        "deleted",
        name,
        "Deleted an unused customer.",
    )
    return redirect("customers")


def _product_payload(product: Product) -> dict[str, object]:
    return {
        "id": str(product.pk),
        "name": product.name,
        "sku": product.sku,
        "category": product.category.name,
        "purchasePrice": float(product.purchase_price),
        "sellingPrice": float(product.selling_price),
        "quantity": float(product.quantity),
        "minimumStock": float(product.minimum_stock),
        "unit": product.unit,
    }


def _purchase_payload(order: PurchaseOrder) -> dict[str, object]:
    items = [
        {
            "productId": str(line.product_id),
            "name": line.product.name,
            "sku": line.product.sku,
            "quantity": float(line.quantity),
            "unitCost": float(line.unit_cost),
            "subtotal": float(line.subtotal),
        }
        for line in order.lines.all()
    ]
    return {
        "id": order.reference,
        "supplier": order.supplier.name,
        "orderDate": order.order_date.isoformat(),
        "expectedDate": order.expected_date.isoformat() if order.expected_date else "",
        "receivedDate": order.received_date.isoformat() if order.received_date else "",
        "status": order.status,
        "notes": order.notes,
        "items": items,
        "total": float(order.total),
    }


def _purchase_page(
    request: HttpRequest,
    server_error: str = "",
    status: int = 200,
) -> HttpResponse:
    workspace = _workspace_for_user(request)
    orders = PurchaseOrder.objects.filter(workspace=workspace).select_related(
        "supplier"
    ).prefetch_related("lines__product")
    products = Product.objects.filter(workspace=workspace).select_related("category")
    suppliers = Supplier.objects.filter(workspace=workspace, active=True)
    return render(
        request,
        "purchases/index.html",
        {
            "demo": False,
            "purchase_data": [_purchase_payload(order) for order in orders],
            "product_data": [_product_payload(product) for product in products],
            "suppliers": list(suppliers.values("id", "name")),
            "server_error": server_error,
        },
        status=status,
    )


@login_required
def purchases_view(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        workspace = _workspace_for_user(request)
        form = PurchaseOrderForm(request.POST, workspace=workspace)
        try:
            lines = parse_transaction_lines(request.POST, workspace, "unit_cost")
        except ValidationError as error:
            lines = []
            server_error = error.messages[0]
        else:
            server_error = ""
        if form.is_valid() and lines:
            try:
                create_purchase_order(
                    workspace,
                    request.user,
                    form.cleaned_data,
                    lines,
                )
            except ValidationError as error:
                server_error = error.messages[0]
            else:
                return redirect("purchases")
        if not server_error:
            server_error = _form_error_message(
                form,
                "Please correct the purchase order details and try again.",
            )
        return _purchase_page(request, server_error, status=400)
    return _purchase_page(request)


@login_required
@require_POST
def purchase_status_view(request: HttpRequest, reference: str) -> HttpResponse:
    workspace = _workspace_for_user(request)
    order = get_object_or_404(
        PurchaseOrder,
        reference=reference,
        workspace=workspace,
    )
    next_status = request.POST.get("status", "")
    allowed = {
        PurchaseOrder.Status.DRAFT: {
            PurchaseOrder.Status.ORDERED,
            PurchaseOrder.Status.CANCELLED,
        },
        PurchaseOrder.Status.ORDERED: {
            PurchaseOrder.Status.RECEIVED,
            PurchaseOrder.Status.CANCELLED,
        },
    }
    if next_status not in allowed.get(order.status, set()):
        return _purchase_page(
            request,
            "This purchase order cannot move to that status.",
            status=409,
        )
    order.status = next_status
    update_fields = ["status", "updated_at"]
    if next_status == PurchaseOrder.Status.RECEIVED:
        order.received_date = timezone.localdate()
        update_fields.append("received_date")
    order.save(update_fields=update_fields)
    record_audit_event(
        workspace,
        request.user,
        "Purchases",
        "status",
        order.reference,
        f"Changed purchase order status to {order.status}.",
    )
    return redirect("purchases")


def _sale_payload(invoice: SalesInvoice) -> dict[str, object]:
    items = [
        {
            "productId": str(line.product_id),
            "name": line.product.name,
            "sku": line.product.sku,
            "quantity": float(line.quantity),
            "unitPrice": float(line.unit_price),
            "subtotal": float(line.subtotal),
        }
        for line in invoice.lines.all()
    ]
    return {
        "id": invoice.reference,
        "customer": invoice.customer.name,
        "saleDate": invoice.sale_date.isoformat(),
        "paymentStatus": invoice.payment_status,
        "notes": invoice.notes,
        "items": items,
        "total": float(invoice.total),
    }


def _sales_page(
    request: HttpRequest,
    server_error: str = "",
    status: int = 200,
) -> HttpResponse:
    workspace = _workspace_for_user(request)
    invoices = SalesInvoice.objects.filter(workspace=workspace).select_related(
        "customer"
    ).prefetch_related("lines__product")
    products = Product.objects.filter(workspace=workspace).select_related("category")
    customers = Customer.objects.filter(workspace=workspace, active=True)
    return render(
        request,
        "sales/index.html",
        {
            "demo": False,
            "sales_data": [_sale_payload(invoice) for invoice in invoices],
            "product_data": [_product_payload(product) for product in products],
            "customers": list(customers.values("id", "name")),
            "server_error": server_error,
        },
        status=status,
    )


@login_required
def sales_view(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        workspace = _workspace_for_user(request)
        form = SalesInvoiceForm(request.POST, workspace=workspace)
        try:
            lines = parse_transaction_lines(request.POST, workspace, "unit_price")
        except ValidationError as error:
            lines = []
            server_error = error.messages[0]
        else:
            server_error = ""
        if form.is_valid() and lines:
            try:
                create_sales_invoice(
                    workspace,
                    request.user,
                    form.cleaned_data,
                    lines,
                )
            except ValidationError as error:
                server_error = error.messages[0]
            else:
                return redirect("sales")
        if not server_error:
            server_error = _form_error_message(
                form,
                "Please correct the sales invoice details and try again.",
            )
        return _sales_page(request, server_error, status=400)
    return _sales_page(request)


@login_required
@require_POST
def sale_status_view(request: HttpRequest, reference: str) -> HttpResponse:
    workspace = _workspace_for_user(request)
    invoice = get_object_or_404(
        SalesInvoice,
        reference=reference,
        workspace=workspace,
    )
    next_status = request.POST.get("status", "")
    if (
        invoice.payment_status != SalesInvoice.PaymentStatus.PENDING
        or next_status
        not in {
            SalesInvoice.PaymentStatus.PAID,
            SalesInvoice.PaymentStatus.CANCELLED,
        }
    ):
        return _sales_page(
            request,
            "This invoice cannot move to that payment status.",
            status=409,
        )
    invoice.payment_status = next_status
    invoice.save(update_fields=["payment_status", "updated_at"])
    record_audit_event(
        workspace,
        request.user,
        "Sales",
        "status",
        invoice.reference,
        f"Changed invoice payment status to {invoice.payment_status}.",
    )
    return redirect("sales")


def _receipt_payload(receipt: StockReceipt) -> dict[str, object]:
    items = [
        {
            "productId": str(line.product_id),
            "name": line.product.name,
            "sku": line.product.sku,
            "quantity": float(line.quantity),
            "unitCost": float(line.unit_cost),
            "subtotal": float(line.quantity * line.unit_cost),
        }
        for line in receipt.lines.all()
    ]
    return {
        "reference": receipt.reference,
        "supplier": receipt.supplier.name,
        "receivedDate": receipt.received_date.isoformat(),
        "createdAt": receipt.created_at.isoformat(),
        "items": items,
        "total": float(receipt.total),
    }


def _stock_in_page(
    request: HttpRequest,
    server_error: str = "",
    status: int = 200,
) -> HttpResponse:
    workspace = _workspace_for_user(request)
    receipts = StockReceipt.objects.filter(workspace=workspace).select_related(
        "supplier"
    ).prefetch_related("lines__product")
    today = timezone.localdate()
    today_receipts = receipts.filter(received_date=today)
    received_today = StockReceiptLine.objects.filter(
        receipt__workspace=workspace,
        receipt__received_date=today,
    ).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
    latest_receipt = receipts.first()
    products = Product.objects.filter(workspace=workspace).select_related("category")
    suppliers = Supplier.objects.filter(workspace=workspace, active=True)
    return render(
        request,
        "stock/in.html",
        {
            "demo": False,
            "product_data": [_product_payload(product) for product in products],
            "supplier_data": list(suppliers.values("id", "name")),
            "receipt_data": [
                _receipt_payload(receipt) for receipt in receipts[:50]
            ],
            "received_today": received_today,
            "entries_today": today_receipts.count(),
            "latest_reference": latest_receipt.reference if latest_receipt else "",
            "stock_summary": {
                "quantityToday": float(received_today),
                "entriesToday": today_receipts.count(),
                "latestReference": latest_receipt.reference if latest_receipt else "",
            },
            "server_error": server_error,
        },
        status=status,
    )


@login_required
def stock_in_view(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        workspace = _workspace_for_user(request)
        form = StockReceiptForm(request.POST, workspace=workspace)
        try:
            lines = parse_transaction_lines(request.POST, workspace, "unit_cost")
        except ValidationError as error:
            lines = []
            server_error = error.messages[0]
        else:
            server_error = ""
        if form.is_valid() and lines:
            try:
                create_stock_receipt(
                    workspace,
                    request.user,
                    form.cleaned_data,
                    lines,
                )
            except ValidationError as error:
                server_error = error.messages[0]
            else:
                return redirect("stock-in")
        if not server_error:
            server_error = _form_error_message(
                form,
                "Please correct the stock receipt details and try again.",
            )
        return _stock_in_page(request, server_error, status=400)
    return _stock_in_page(request)


def _issue_payload(issue: StockIssue) -> dict[str, object]:
    items = [
        {
            "productId": str(line.product_id),
            "name": line.product.name,
            "sku": line.product.sku,
            "quantity": float(line.quantity),
            "unitValue": float(line.unit_value),
            "subtotal": float(line.quantity * line.unit_value),
        }
        for line in issue.lines.all()
    ]
    return {
        "reference": issue.reference,
        "reason": issue.reason,
        "issueDate": issue.issue_date.isoformat(),
        "createdAt": issue.created_at.isoformat(),
        "items": items,
        "total": float(issue.total),
    }


def _stock_out_page(
    request: HttpRequest,
    server_error: str = "",
    status: int = 200,
) -> HttpResponse:
    workspace = _workspace_for_user(request)
    issues = StockIssue.objects.filter(workspace=workspace).prefetch_related(
        "lines__product"
    )
    today = timezone.localdate()
    today_issues = issues.filter(issue_date=today)
    issued_today = StockIssueLine.objects.filter(
        issue__workspace=workspace,
        issue__issue_date=today,
    ).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
    latest_issue = issues.first()
    products = Product.objects.filter(workspace=workspace).select_related("category")
    return render(
        request,
        "stock/out.html",
        {
            "demo": False,
            "product_data": [_product_payload(product) for product in products],
            "issue_data": [_issue_payload(issue) for issue in issues[:50]],
            "issued_today": issued_today,
            "entries_today": today_issues.count(),
            "latest_reference": latest_issue.reference if latest_issue else "",
            "stock_summary": {
                "quantityToday": float(issued_today),
                "entriesToday": today_issues.count(),
                "latestReference": latest_issue.reference if latest_issue else "",
            },
            "server_error": server_error,
        },
        status=status,
    )


@login_required
def stock_out_view(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        workspace = _workspace_for_user(request)
        form = StockIssueForm(request.POST, workspace=workspace)
        try:
            lines = parse_transaction_lines(request.POST, workspace, "unit_value")
        except ValidationError as error:
            lines = []
            server_error = error.messages[0]
        else:
            server_error = ""
        if form.is_valid() and lines:
            try:
                create_stock_issue(
                    workspace,
                    request.user,
                    form.cleaned_data,
                    lines,
                )
            except ValidationError as error:
                server_error = error.messages[0]
            else:
                return redirect("stock-out")
        if not server_error:
            server_error = _form_error_message(
                form,
                "Please correct the stock issue details and try again.",
            )
        return _stock_out_page(request, server_error, status=400)
    return _stock_out_page(request)
