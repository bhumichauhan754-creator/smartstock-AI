"""URL configuration for SmartStock."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth.decorators import login_required
from django.urls import include, path
from django.views.generic import RedirectView, TemplateView

from accounts import views as account_views
from inventory import views as inventory_views


def protected_template(template_name: str):
    """Serve a frontend template only to authenticated users."""
    return login_required(TemplateView.as_view(template_name=template_name))


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", RedirectView.as_view(url="/dashboard/", permanent=False), name="home"),
    path("", include("accounts.urls")),
    path("dashboard/", inventory_views.dashboard_view, name="dashboard"),
    path("products/", inventory_views.products_view, name="products"),
    path("products/add/", inventory_views.add_product_view, name="product-add"),
    path(
        "products/<int:product_id>/edit/",
        inventory_views.edit_product_view,
        name="product-edit",
    ),
    path(
        "products/<int:product_id>/delete/",
        inventory_views.delete_product_view,
        name="product-delete",
    ),
    path("categories/", inventory_views.categories_view, name="categories"),
    path("categories/add/", inventory_views.add_category_view, name="category-add"),
    path(
        "categories/<int:category_id>/edit/",
        inventory_views.edit_category_view,
        name="category-edit",
    ),
    path(
        "categories/<int:category_id>/delete/",
        inventory_views.delete_category_view,
        name="category-delete",
    ),
    path("stock/in/", inventory_views.stock_in_view, name="stock-in"),
    path("stock/out/", inventory_views.stock_out_view, name="stock-out"),
    path("purchases/", inventory_views.purchases_view, name="purchases"),
    path(
        "purchases/<path:reference>/status/",
        inventory_views.purchase_status_view,
        name="purchase-status",
    ),
    path("sales/", inventory_views.sales_view, name="sales"),
    path(
        "sales/<path:reference>/status/",
        inventory_views.sale_status_view,
        name="sale-status",
    ),
    path("suppliers/", inventory_views.suppliers_view, name="suppliers"),
    path("suppliers/add/", inventory_views.add_supplier_view, name="supplier-add"),
    path(
        "suppliers/<int:supplier_id>/edit/",
        inventory_views.edit_supplier_view,
        name="supplier-edit",
    ),
    path(
        "suppliers/<int:supplier_id>/status/",
        inventory_views.supplier_status_view,
        name="supplier-status",
    ),
    path(
        "suppliers/<int:supplier_id>/delete/",
        inventory_views.delete_supplier_view,
        name="supplier-delete",
    ),
    path("customers/", inventory_views.customers_view, name="customers"),
    path("customers/add/", inventory_views.add_customer_view, name="customer-add"),
    path(
        "customers/<int:customer_id>/edit/",
        inventory_views.edit_customer_view,
        name="customer-edit",
    ),
    path(
        "customers/<int:customer_id>/status/",
        inventory_views.customer_status_view,
        name="customer-status",
    ),
    path(
        "customers/<int:customer_id>/delete/",
        inventory_views.delete_customer_view,
        name="customer-delete",
    ),
    path("reports/", inventory_views.reports_view, name="reports"),
    path("audit/", inventory_views.audit_view, name="audit"),
    path("profile/", account_views.profile_view, name="profile"),
    path("settings/", account_views.settings_view, name="settings"),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
