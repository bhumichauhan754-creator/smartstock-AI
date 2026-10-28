async function pageRequest(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (response.status === 401) {
        window.location.href = "/login";
        return null;
    }
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
}

document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
        await pageRequest("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    });
});

const profileForm = document.getElementById("profileForm");
if (profileForm) {
    pageRequest("/api/profile").then((user) => {
        if (!user) return;
        document.getElementById("profileName").value = user.name;
        document.getElementById("profileEmail").value = user.email;
        document.getElementById("profileCreated").textContent = new Date(user.created_at).toLocaleDateString();
    }).catch((error) => { document.getElementById("pageMessage").textContent = error.message; });
    profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            await pageRequest("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: document.getElementById("profileName").value }),
            });
            document.getElementById("pageMessage").textContent = "Profile updated successfully.";
        } catch (error) { document.getElementById("pageMessage").textContent = error.message; }
    });
}

if (document.getElementById("reportCards")) {
    pageRequest("/api/reports").then((report) => {
        document.getElementById("reportProducts").textContent = report.total_products;
        document.getElementById("reportValue").textContent = Number(report.total_stock_value).toFixed(2);
        document.getElementById("reportLowStock").textContent = report.low_stock_count;
        document.getElementById("reportGenerated").textContent = new Date().toLocaleString();
        const healthy = Math.max(report.total_products - report.low_stock_count, 0);
        const total = Math.max(report.total_products, 1);
        document.getElementById("healthyBar").style.width = `${healthy / total * 100}%`;
        document.getElementById("lowBar").style.width = `${report.low_stock_count / total * 100}%`;
    }).catch((error) => { document.getElementById("pageMessage").textContent = error.message; });
}

if (document.getElementById("historyTable")) {
    pageRequest("/api/inventory-history").then((history) => {
        document.getElementById("historyTable").innerHTML = history.length
            ? history.map((item) => `<tr><td>${item.action}</td><td>${item.product_name}</td><td>${item.created_at}</td></tr>`).join("")
            : '<tr><td colspan="3" class="table-message">No inventory history is available yet.</td></tr>';
    }).catch((error) => { document.getElementById("pageMessage").textContent = error.message; });
}

const entityConfig = {
    category: { endpoint: "/api/categories", fields: ["name", "description"] },
    supplier: { endpoint: "/api/suppliers", fields: ["name", "email", "phone", "address"] },
    customer: { endpoint: "/api/customers", fields: ["name", "email", "phone", "address"] },
};

Object.entries(entityConfig).forEach(([entity, config]) => {
    const form = document.getElementById(`${entity}Form`);
    if (!form) return;
    const table = document.getElementById(`${entity}Table`);
    const load = () => pageRequest(config.endpoint).then((items) => {
        table.innerHTML = items.length
            ? items.map((item) => `<tr>${config.fields.map((field) => `<td>${escapePageHtml(item[field])}</td>`).join("")}</tr>`).join("")
            : `<tr><td colspan="${config.fields.length}" class="table-message">No records found.</td></tr>`;
    }).catch((error) => { document.getElementById("pageMessage").textContent = error.message; });
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const body = {};
        config.fields.forEach((field) => { body[field] = document.getElementById(`${entity}${capitalize(field)}`).value; });
        try {
            await pageRequest(config.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            form.reset();
            document.getElementById("pageMessage").textContent = `${capitalize(entity)} created successfully.`;
            load();
        } catch (error) { document.getElementById("pageMessage").textContent = error.message; }
    });
    load();
});

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapePageHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[character]));
}

const productManagementForm = document.getElementById("productManagementForm");
if (productManagementForm) {
    let products = [];
    let page = 1;
    const pageSize = 10;
    const renderProducts = () => {
        const query = document.getElementById("productSearch").value.toLowerCase();
        const filtered = products.filter((product) => product.name.toLowerCase().includes(query));
        const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
        document.getElementById("managementTable").innerHTML = pageItems.length
            ? pageItems.map((product) => `<tr><td><a href="/product-details?id=${product.id}">${escapePageHtml(product.name)}</a></td><td>${product.quantity}</td><td>${product.unit_price}</td><td><button class="btn btn-sm btn-outline-primary management-edit" data-id="${product.id}">Edit</button> <button class="btn btn-sm btn-outline-danger management-delete" data-id="${product.id}">Delete</button></td></tr>`).join("")
            : '<tr><td colspan="4" class="table-message">No products found.</td></tr>';
        document.getElementById("pageNumber").textContent = `Page ${page}`;
        document.getElementById("previousPage").disabled = page === 1;
        document.getElementById("nextPage").disabled = page * pageSize >= filtered.length;
    };
    const loadProducts = () => pageRequest("/api/products").then((data) => { products = data; page = 1; renderProducts(); });
    productManagementForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const id = document.getElementById("productId").value;
        const body = { name: document.getElementById("productName").value, quantity: Number(document.getElementById("productQuantity").value), unit_price: Number(document.getElementById("productPrice").value) };
        try {
            await pageRequest(id ? `/api/products/${id}` : "/api/products", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            productManagementForm.reset();
            document.getElementById("productId").value = "";
            document.getElementById("pageMessage").textContent = id ? "Product updated." : "Product created.";
            loadProducts();
        } catch (error) { document.getElementById("pageMessage").textContent = error.message; }
    });
    document.addEventListener("click", async (event) => {
        const edit = event.target.closest(".management-edit");
        const remove = event.target.closest(".management-delete");
        if (edit) {
            const product = products.find((item) => item.id === Number(edit.dataset.id));
            document.getElementById("productId").value = product.id;
            document.getElementById("productName").value = product.name;
            document.getElementById("productQuantity").value = product.quantity;
            document.getElementById("productPrice").value = product.unit_price;
        }
        if (remove && window.confirm("Delete this product permanently?")) {
            await pageRequest(`/api/products/${remove.dataset.id}`, { method: "DELETE" });
            loadProducts();
        }
    });
    document.getElementById("productSearch").addEventListener("input", () => { page = 1; renderProducts(); });
    document.getElementById("previousPage").addEventListener("click", () => { page -= 1; renderProducts(); });
    document.getElementById("nextPage").addEventListener("click", () => { page += 1; renderProducts(); });
    loadProducts();
}

const stockForm = document.getElementById("stockForm");
if (stockForm) {
    pageRequest("/api/products").then((products) => {
        document.getElementById("stockProduct").innerHTML = products.map((product) => `<option value="${product.id}">${escapePageHtml(product.name)} (${product.quantity})</option>`).join("");
    });
    stockForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            await pageRequest("/api/stock-transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: Number(document.getElementById("stockProduct").value), transaction_type: document.getElementById("transactionType").value, quantity: Number(document.getElementById("transactionQuantity").value), notes: document.getElementById("transactionNotes").value }) });
            stockForm.reset();
            document.getElementById("pageMessage").textContent = "Stock transaction recorded successfully.";
        } catch (error) { document.getElementById("pageMessage").textContent = error.message; }
    });
}
