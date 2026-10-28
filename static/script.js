const endpoints = {
    stats: "/api/dashboard-stats",
    products: "/api/products",
    lowStock: "/api/low-stock",
};

const elements = {
    totalProducts: document.getElementById("totalProducts"),
    totalQuantity: document.getElementById("totalQuantity"),
    lowStockCount: document.getElementById("lowStockCount"),
    productCount: document.getElementById("productCount"),
    productsTable: document.getElementById("productsTable"),
    lowStockTable: document.getElementById("lowStockTable"),
    errorAlert: document.getElementById("errorAlert"),
    productForm: document.getElementById("productForm"),
    formMessage: document.getElementById("formMessage"),
    saveProductButton: document.getElementById("saveProductButton"),
    userName: document.getElementById("userName"),
    logoutButton: document.getElementById("logoutButton"),
    editProductForm: document.getElementById("editProductForm"),
};

let editModal;

async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (response.status === 401) {
        window.location.href = "/login";
        throw new Error(data.error);
    }
    if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
    }
    return data;
}

function showFormMessage(message, isError = false) {
    elements.formMessage.textContent = message;
    elements.formMessage.className = `form-message mx-3 mx-lg-4 mb-3 ${isError ? "form-message-error" : "form-message-success"}`;
}

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value) || 0);
}

function getProductStatus(quantity) {
    return Number(quantity) < 10
        ? { label: "Low stock", className: "status-low" }
        : { label: "In stock", className: "status-healthy" };
}

function productRow(product) {
    const status = getProductStatus(product.quantity);
    return `
        <tr>
            <td class="product-name">${escapeHtml(product.name)}</td>
            <td class="quantity">${formatNumber(product.quantity)}</td>
            <td><span class="status-badge ${status.className}">${status.label}</span></td>
            <td class="text-nowrap">
                <button class="btn btn-sm btn-outline-primary edit-product" data-product="${product.id}">Edit</button>
                <button class="btn btn-sm btn-outline-danger delete-product" data-product="${product.id}">Delete</button>
            </td>
        </tr>
    `;
}

function renderTable(table, products, emptyMessage) {
    if (!products.length) {
        table.innerHTML = `<tr><td colspan="4" class="table-message">${emptyMessage}</td></tr>`;
        return;
    }
    table.innerHTML = products.map(productRow).join("");
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[character]));
}

function showError(message) {
    elements.errorAlert.textContent = message;
    elements.errorAlert.classList.remove("d-none");
}

function showEmptyState(message) {
    renderTable(elements.productsTable, [], message);
    renderTable(elements.lowStockTable, [], message);
}

async function loadDashboard() {
    try {
        const [stats, products, lowStock] = await Promise.all([
            fetchJson(endpoints.stats), fetchJson(endpoints.products), fetchJson(endpoints.lowStock),
        ]);
        elements.totalProducts.textContent = formatNumber(stats.total_products);
        elements.totalQuantity.textContent = formatNumber(
            products.reduce((total, product) => total + Number(product.quantity || 0), 0),
        );
        elements.lowStockCount.textContent = formatNumber(stats.low_stock_count);
        elements.productCount.textContent = `${formatNumber(products.length)} products`;
        renderTable(elements.productsTable, products, "No products found.");
        renderTable(elements.lowStockTable, lowStock, "No low stock products. Everything looks good!");
    } catch (error) {
        console.error("Could not load dashboard data:", error);
        showError(error.message || "Inventory data is unavailable.");
        showEmptyState("Inventory data is unavailable.");
    }
}

function findProduct(productId) {
    return fetchJson(endpoints.products).then((products) => products.find((product) => product.id === productId));
}

document.addEventListener("click", async (event) => {
    const editButton = event.target.closest(".edit-product");
    const deleteButton = event.target.closest(".delete-product");
    if (editButton) {
        const product = await findProduct(Number(editButton.dataset.product));
        if (!product) return;
        document.getElementById("editProductId").value = product.id;
        document.getElementById("editProductName").value = product.name;
        document.getElementById("editProductQuantity").value = product.quantity;
        document.getElementById("editUnitPrice").value = product.unit_price;
        editModal.show();
    }
    if (deleteButton) {
        if (!window.confirm("Delete this product permanently?")) return;
        try {
            await fetchJson(`${endpoints.products}/${deleteButton.dataset.product}`, { method: "DELETE" });
            await loadDashboard();
        } catch (error) {
            showError(error.message);
        }
    }
});

elements.productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    elements.saveProductButton.disabled = true;
    const formData = new FormData(elements.productForm);
    try {
        await fetchJson(endpoints.products, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: formData.get("name"),
                quantity: Number(formData.get("quantity")),
                unit_price: Number(formData.get("unit_price")),
            }),
        });
        elements.productForm.reset();
        document.getElementById("productQuantity").value = "0";
        document.getElementById("unitPrice").value = "0";
        showFormMessage("Product saved successfully.");
        await loadDashboard();
    } catch (error) {
        showFormMessage(error.message || "Product could not be saved.", true);
    } finally {
        elements.saveProductButton.disabled = false;
    }
});

elements.editProductForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await fetchJson(`${endpoints.products}/${document.getElementById("editProductId").value}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: document.getElementById("editProductName").value,
                quantity: Number(document.getElementById("editProductQuantity").value),
                unit_price: Number(document.getElementById("editUnitPrice").value),
            }),
        });
        editModal.hide();
        await loadDashboard();
    } catch (error) {
        showError(error.message);
    }
});

elements.logoutButton.addEventListener("click", async () => {
    await fetchJson("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
});

editModal = new bootstrap.Modal(document.getElementById("editProductModal"));
fetchJson("/api/auth/me").then((user) => {
    if (!user.authenticated) {
        window.location.href = "/login";
        return;
    }
    elements.userName.textContent = `Hello, ${user.name}`;
    loadDashboard();
});
