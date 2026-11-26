"""Product catalog CRUD tests for authenticated workspaces."""

from datetime import date

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse

from accounts.models import UserProfile, Workspace
from inventory.models import (
    AuditEvent,
    Category,
    Customer,
    Product,
    PurchaseOrder,
    SalesInvoice,
    StockIssue,
    StockReceipt,
    Supplier,
)


class ProductManagementTests(TestCase):
    def setUp(self) -> None:
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="owner@example.com",
            email="owner@example.com",
            password="Secure-Owner!2026",
        )
        self.workspace = Workspace.objects.create(
            owner=self.user,
            name="Owner Workspace",
            contact_email=self.user.email,
        )
        self.category = Category.objects.create(
            workspace=self.workspace,
            name="Electronics",
        )
        self.client.force_login(self.user)
        self.product_data = {
            "name": "Wireless Headphones",
            "sku": "ELEC-042",
            "category": "Electronics",
            "description": "Noise cancelling headphones",
            "purchase_price": "42.00",
            "selling_price": "79.00",
            "quantity": "8",
            "minimum_stock": "12",
            "unit": Product.Unit.UNITS,
        }

    def create_product(self, **overrides) -> Product:
        product_data = {**self.product_data, **overrides}
        product_data.pop("category")
        return Product.objects.create(
            workspace=self.workspace,
            category=self.category,
            **product_data,
        )

    def test_create_product_persists_workspace_scoped_catalog_fields(self) -> None:
        response = self.client.post(reverse("product-add"), self.product_data)

        self.assertRedirects(response, reverse("products"))
        product = Product.objects.get(sku="ELEC-042")
        self.assertEqual(product.workspace, self.workspace)
        self.assertEqual(product.category, self.category)
        self.assertEqual(product.quantity, 8)
        self.assertEqual(product.stock_status, "low-stock")

    def test_edit_product_persists_updates_for_the_current_workspace(self) -> None:
        product = self.create_product()
        updated_data = {
            **self.product_data,
            "name": "Studio Headphones",
            "quantity": "15",
        }

        response = self.client.post(
            reverse("product-edit", args=[product.pk]),
            updated_data,
        )

        self.assertRedirects(response, reverse("products"))
        product.refresh_from_db()
        self.assertEqual(product.name, "Studio Headphones")
        self.assertEqual(product.quantity, 15)

    def test_product_list_uses_database_products_and_hides_sample_rows(self) -> None:
        self.create_product()

        response = self.client.get(reverse("products"))

        self.assertContains(response, 'data-demo="false"')
        self.assertContains(response, "Wireless Headphones")
        self.assertContains(response, "ELEC-042")
        self.assertContains(response, "₹42.00")
        self.assertContains(response, "₹79.00")
        self.assertNotContains(response, "$79.00")
        self.assertNotContains(response, "{% for product in products %}")

    def test_sku_is_unique_without_case_sensitivity_within_workspace(self) -> None:
        self.create_product()
        duplicate_data = {**self.product_data, "sku": "elec-042"}

        response = self.client.post(reverse("product-add"), duplicate_data)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Product.objects.filter(workspace=self.workspace).count(), 1)

    def test_product_image_upload_must_contain_a_supported_image(self) -> None:
        invalid_image = SimpleUploadedFile(
            "not-an-image.png",
            b"not an image",
            content_type="image/png",
        )

        response = self.client.post(
            reverse("product-add"),
            {**self.product_data, "image": invalid_image},
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Product.objects.filter(workspace=self.workspace).exists())

    def test_product_cannot_be_edited_by_another_workspace(self) -> None:
        product = self.create_product()
        other_user = get_user_model().objects.create_user(
            username="other@example.com",
            email="other@example.com",
            password="Secure-Other!2026",
        )
        Workspace.objects.create(
            owner=other_user,
            name="Other Workspace",
            contact_email=other_user.email,
        )
        self.client.force_login(other_user)

        response = self.client.get(reverse("product-edit", args=[product.pk]))

        self.assertEqual(response.status_code, 404)

    def test_delete_requires_post_and_removes_only_the_owned_product(self) -> None:
        product = self.create_product()
        delete_url = reverse("product-delete", args=[product.pk])

        self.assertEqual(self.client.get(delete_url).status_code, 405)
        response = self.client.post(delete_url)

        self.assertRedirects(response, reverse("products"))
        self.assertFalse(Product.objects.filter(pk=product.pk).exists())


class CategoryManagementTests(TestCase):
    def setUp(self) -> None:
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="category-owner@example.com",
            email="category-owner@example.com",
            password="Secure-Owner!2026",
        )
        self.workspace = Workspace.objects.create(
            owner=self.user,
            name="Category Workspace",
            contact_email=self.user.email,
        )
        self.category = Category.objects.create(
            workspace=self.workspace,
            name="Electronics",
        )
        self.client.force_login(self.user)
        self.category_data = {
            "name": "Accessories",
            "description": "Small electronic accessories",
            "active": "on",
        }

    def test_category_list_renders_workspace_data_and_summary_counts(self) -> None:
        response = self.client.get(reverse("categories"))

        self.assertContains(response, 'data-demo="false"')
        self.assertContains(response, "Electronics")
        self.assertContains(response, 'id="totalCategories">1</strong>')

    def test_create_category_persists_workspace_owned_category(self) -> None:
        response = self.client.post(reverse("category-add"), self.category_data)

        self.assertRedirects(response, reverse("categories"))
        category = Category.objects.get(name="Accessories")
        self.assertEqual(category.workspace, self.workspace)
        self.assertTrue(category.active)

    def test_category_name_is_unique_without_case_sensitivity(self) -> None:
        duplicate_data = {**self.category_data, "name": "electronics"}

        response = self.client.post(reverse("category-add"), duplicate_data)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Category.objects.filter(workspace=self.workspace).count(), 1)

    def test_edit_can_archive_category_and_existing_products_remain_editable(self) -> None:
        product = Product.objects.create(
            workspace=self.workspace,
            category=self.category,
            name="Headphones",
            sku="ELEC-010",
            purchase_price="20.00",
            selling_price="40.00",
            quantity=5,
            minimum_stock=2,
        )
        response = self.client.post(
            reverse("category-edit", args=[self.category.pk]),
            {"name": self.category.name, "description": "", "active": ""},
        )

        self.assertRedirects(response, reverse("categories"))
        self.category.refresh_from_db()
        self.assertFalse(self.category.active)
        product_edit_response = self.client.get(
            reverse("product-edit", args=[product.pk])
        )
        self.assertContains(product_edit_response, 'value="Electronics"')

    def test_category_cannot_be_deleted_while_products_are_assigned(self) -> None:
        Product.objects.create(
            workspace=self.workspace,
            category=self.category,
            name="Headphones",
            sku="ELEC-010",
            purchase_price="20.00",
            selling_price="40.00",
            quantity=5,
            minimum_stock=2,
        )

        response = self.client.post(reverse("category-delete", args=[self.category.pk]))

        self.assertEqual(response.status_code, 409)
        self.assertTrue(Category.objects.filter(pk=self.category.pk).exists())
        self.assertIn(b"cannot be deleted", response.content)

    def test_unassigned_category_can_be_deleted(self) -> None:
        response = self.client.post(reverse("category-delete", args=[self.category.pk]))

        self.assertRedirects(response, reverse("categories"))
        self.assertFalse(Category.objects.filter(pk=self.category.pk).exists())

    def test_products_can_use_categories_added_to_the_workspace(self) -> None:
        category = Category.objects.create(
            workspace=self.workspace,
            name="Tools",
        )
        response = self.client.post(
            reverse("product-add"),
            {
                "name": "Precision screwdriver",
                "sku": "TOOL-001",
                "category": category.name,
                "purchase_price": "5.00",
                "selling_price": "12.00",
                "quantity": "10",
                "minimum_stock": "2",
                "unit": Product.Unit.UNITS,
            },
        )

        self.assertRedirects(response, reverse("products"))
        self.assertEqual(Product.objects.get(sku="TOOL-001").category, category)

    def test_category_is_isolated_from_other_workspaces(self) -> None:
        other_user = get_user_model().objects.create_user(
            username="other-category-owner@example.com",
            email="other-category-owner@example.com",
            password="Secure-Other!2026",
        )
        Workspace.objects.create(
            owner=other_user,
            name="Other Workspace",
            contact_email=other_user.email,
        )
        self.client.force_login(other_user)

        response = self.client.post(
            reverse("category-edit", args=[self.category.pk]),
            self.category_data,
        )

        self.assertEqual(response.status_code, 404)


class WorkspaceApplicationTests(TestCase):
    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username="workspace-owner@example.com",
            email="workspace-owner@example.com",
            password="Secure-Owner!2026",
            first_name="Bhumi",
            last_name="Chauhan",
        )
        self.workspace = Workspace.objects.create(
            owner=self.user,
            name="Owner Workspace",
            contact_email=self.user.email,
        )
        UserProfile.objects.create(user=self.user)
        self.category = Category.objects.create(
            workspace=self.workspace,
            name="Electronics",
        )
        self.product = Product.objects.create(
            workspace=self.workspace,
            category=self.category,
            name="Wireless Headphones",
            sku="ELEC-042",
            purchase_price="42.00",
            selling_price="79.00",
            quantity="10",
            minimum_stock="3",
        )
        self.supplier = Supplier.objects.create(
            workspace=self.workspace,
            name="Acme Supply Co.",
            contact_name="Olivia Chen",
            email="olivia@example.com",
        )
        self.customer = Customer.objects.create(
            workspace=self.workspace,
            name="Northside Design Studio",
            contact_name="Arjun Patel",
        )
        self.client.force_login(self.user)

    def test_workspace_pages_render_database_mode(self) -> None:
        for page_name in (
            "dashboard",
            "products",
            "categories",
            "stock-in",
            "stock-out",
            "purchases",
            "sales",
            "suppliers",
            "customers",
            "reports",
            "audit",
            "profile",
            "settings",
        ):
            with self.subTest(page=page_name):
                response = self.client.get(reverse(page_name))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, 'data-demo="false"')

    def test_dashboard_handles_empty_category_with_other_categories_in_stock(self) -> None:
        Category.objects.create(workspace=self.workspace, name="Empty category")

        response = self.client.get(reverse("dashboard"))

        self.assertEqual(response.status_code, 200)
        empty_category = next(
            item
            for item in response.context["category_data"]
            if item["name"] == "Empty category"
        )
        self.assertEqual(empty_category["quantity"], 0)
        self.assertEqual(empty_category["percentage"], 0)

    def test_stock_receipt_increases_quantity_and_records_audit_event(self) -> None:
        response = self.client.post(
            reverse("stock-in"),
            {
                "reference": "IN-2026-001",
                "received_date": date.today().isoformat(),
                "supplier": str(self.supplier.pk),
                "product_id": [str(self.product.pk)],
                "quantity": ["3"],
                "unit_cost": ["40.00"],
            },
        )

        self.assertRedirects(response, reverse("stock-in"))
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 13)
        self.assertTrue(StockReceipt.objects.filter(reference="IN-2026-001").exists())
        self.assertTrue(AuditEvent.objects.filter(module="Stock", action="stock").exists())

    def test_stock_issue_rejects_insufficient_quantity_without_partial_changes(self) -> None:
        response = self.client.post(
            reverse("stock-out"),
            {
                "reference": "OUT-2026-001",
                "issue_date": date.today().isoformat(),
                "reason": StockIssue.Reason.CUSTOMER_SALE,
                "product_id": [str(self.product.pk)],
                "quantity": ["11"],
                "unit_value": ["79.00"],
            },
        )

        self.assertEqual(response.status_code, 400)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 10)
        self.assertFalse(StockIssue.objects.filter(reference="OUT-2026-001").exists())

    def test_supplier_and_customer_directory_actions_persist_status(self) -> None:
        supplier_response = self.client.post(
            reverse("supplier-add"),
            {
                "name": "Office Hub",
                "contact_name": "Grace Miller",
                "email": "grace@example.com",
                "phone": "",
                "address": "",
                "notes": "",
                "active": "on",
            },
        )
        self.assertRedirects(supplier_response, reverse("suppliers"))
        supplier = Supplier.objects.get(name="Office Hub")
        status_response = self.client.post(
            reverse("supplier-status", args=[supplier.pk]),
            {"active": "false"},
        )
        self.assertRedirects(status_response, reverse("suppliers"))
        supplier.refresh_from_db()
        self.assertFalse(supplier.active)

        customer_response = self.client.post(
            reverse("customer-add"),
            {
                "name": "Willow Creek Retail",
                "customer_type": Customer.Type.BUSINESS,
                "contact_name": "Nina Shah",
                "email": "",
                "phone": "",
                "address": "",
                "notes": "",
                "active": "on",
            },
        )
        self.assertRedirects(customer_response, reverse("customers"))
        customer = Customer.objects.get(name="Willow Creek Retail")
        status_response = self.client.post(
            reverse("customer-status", args=[customer.pk]),
            {"active": "false"},
        )
        self.assertRedirects(status_response, reverse("customers"))
        customer.refresh_from_db()
        self.assertFalse(customer.active)

    def test_purchase_and_invoice_forms_resolve_workspace_relations(self) -> None:
        purchase_response = self.client.post(
            reverse("purchases"),
            {
                "reference": "PO-2026-001",
                "supplier": str(self.supplier.pk),
                "order_date": date.today().isoformat(),
                "product_id": [str(self.product.pk)],
                "quantity": ["2"],
                "unit_cost": ["42.00"],
            },
        )
        self.assertRedirects(purchase_response, reverse("purchases"))
        order = PurchaseOrder.objects.get(reference="PO-2026-001")
        self.assertEqual(order.supplier, self.supplier)
        self.assertEqual(order.lines.get().product, self.product)

        sale_response = self.client.post(
            reverse("sales"),
            {
                "reference": "INV-2026-001",
                "customer": str(self.customer.pk),
                "sale_date": date.today().isoformat(),
                "payment_status": SalesInvoice.PaymentStatus.PENDING,
                "product_id": [str(self.product.pk)],
                "quantity": ["1"],
                "unit_price": ["79.00"],
            },
        )
        self.assertRedirects(sale_response, reverse("sales"))
        invoice = SalesInvoice.objects.get(reference="INV-2026-001")
        self.assertEqual(invoice.customer, self.customer)
        self.assertEqual(invoice.lines.get().product, self.product)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 10)

    def test_purchase_and_invoice_status_routes_accept_references(self) -> None:
        purchase = PurchaseOrder.objects.create(
            workspace=self.workspace,
            reference="PO-2026-STATUS",
            supplier=self.supplier,
            order_date=date.today(),
        )
        purchase_status = self.client.post(
            reverse("purchase-status", args=[purchase.reference]),
            {"status": PurchaseOrder.Status.RECEIVED},
        )
        self.assertRedirects(purchase_status, reverse("purchases"))
        purchase.refresh_from_db()
        self.assertEqual(purchase.status, PurchaseOrder.Status.RECEIVED)

        invoice = SalesInvoice.objects.create(
            workspace=self.workspace,
            reference="INV-2026-STATUS",
            customer=self.customer,
            sale_date=date.today(),
        )
        sale_status = self.client.post(
            reverse("sale-status", args=[invoice.reference]),
            {"status": SalesInvoice.PaymentStatus.PAID},
        )
        self.assertRedirects(sale_status, reverse("sales"))
        invoice.refresh_from_db()
        self.assertEqual(invoice.payment_status, SalesInvoice.PaymentStatus.PAID)

    def test_profile_and_workspace_settings_persist_to_database(self) -> None:
        profile_response = self.client.post(
            reverse("profile"),
            {
                "full_name": "Bhumi Patel",
                "email": "bhumi.patel@example.com",
                "phone": "+91 98765 43210",
                "department": "Operations",
                "timezone": "Asia/Kolkata",
                "bio": "Inventory manager",
            },
        )
        self.assertRedirects(profile_response, reverse("profile"))
        self.user.refresh_from_db()
        self.assertEqual(self.user.get_full_name(), "Bhumi Patel")
        self.assertEqual(self.user.email, "bhumi.patel@example.com")

        settings_response = self.client.post(
            reverse("settings"),
            {
                "workspace_name": "Updated Workspace",
                "team_name": "Inventory Team",
                "contact_email": "stock@example.com",
                "timezone": "Asia/Kolkata",
                "low_stock_notifications": "on",
                "sales_notifications": "on",
            },
        )
        self.assertRedirects(settings_response, reverse("settings"))
        self.workspace.refresh_from_db()
        self.assertEqual(self.workspace.name, "Updated Workspace")
        self.assertFalse(self.workspace.purchase_notifications)
