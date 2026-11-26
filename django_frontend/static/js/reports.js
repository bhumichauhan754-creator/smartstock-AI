"use strict";

const productStorageKey = "smartstock.sampleProducts";
const categoryStorageKey = "smartstock.sampleCategories";
const seededProducts = [
    { id: "1", name: "Wireless Headphones", sku: "ELEC-001", category: "Electronics", purchasePrice: 42, sellingPrice: 79, quantity: 86, minimumStock: 20, unit: "Units" },
    { id: "2", name: "USB-C Hub", sku: "ACC-014", category: "Accessories", purchasePrice: 18.5, sellingPrice: 34.99, quantity: 8, minimumStock: 15, unit: "Units" },
    { id: "3", name: "Ergonomic Office Chair", sku: "FURN-008", category: "Furniture", purchasePrice: 118, sellingPrice: 219, quantity: 24, minimumStock: 10, unit: "Units" },
    { id: "4", name: "Wireless Mouse", sku: "ACC-023", category: "Accessories", purchasePrice: 12, sellingPrice: 24.99, quantity: 142, minimumStock: 30, unit: "Units" },
    { id: "5", name: "Mechanical Keyboard", sku: "ELEC-032", category: "Electronics", purchasePrice: 56, sellingPrice: 99, quantity: 6, minimumStock: 12, unit: "Units" },
    { id: "6", name: "Desk Organizer Set", sku: "OFF-019", category: "Office supplies", purchasePrice: 8.5, sellingPrice: 17.99, quantity: 54, minimumStock: 15, unit: "Units" },
    { id: "7", name: "Bluetooth Speaker", sku: "ELEC-041", category: "Electronics", purchasePrice: 29, sellingPrice: 54, quantity: 0, minimumStock: 10, unit: "Units" },
    { id: "8", name: "Notebook Multipack", sku: "OFF-027", category: "Office supplies", purchasePrice: 5, sellingPrice: 11.5, quantity: 210, minimumStock: 40, unit: "Units" }
];
const seededCategories = [
    { id: "cat-electronics", name: "Electronics", isActive: true },
    { id: "cat-accessories", name: "Accessories", isActive: true },
    { id: "cat-office", name: "Office supplies", isActive: true },
    { id: "cat-furniture", name: "Furniture", isActive: true },
    { id: "cat-packaging", name: "Packaging", isActive: true },
    { id: "cat-seasonal", name: "Seasonal", isActive: false }
];
const reportRows = document.querySelector("#reportRows");
const reportSearch = document.querySelector("#reportSearch");
const reportCategoryFilter = document.querySelector("#reportCategoryFilter");
const reportStockFilter = document.querySelector("#reportStockFilter");
const reportEmpty = document.querySelector("#reportEmpty");
const reportResults = document.querySelector("#reportResults");
const categoryChart = document.querySelector("#categoryChart");
const categoryChartEmpty = document.querySelector("#categoryChartEmpty");
const healthRows = document.querySelector("#healthRows");
const reportStorageWarning = document.querySelector("#reportStorageWarning");
const reportFeedback = document.querySelector("#reportFeedback");
const exportReportButton = document.querySelector("#exportReportButton");
const reportStats = {
    products: document.querySelector("#reportProductCount"),
    units: document.querySelector("#reportUnitCount"),
    value: document.querySelector("#reportInventoryValue"),
    attention: document.querySelector("#reportAttentionCount"),
    healthTotal: document.querySelector("#healthProductTotal")
};
let products = [];
let categoryNames = [];
let storageReady = true;

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(value);
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 2
    }).format(value);
}

function readSavedProducts() {
    const rawProducts = window.localStorage.getItem(productStorageKey);
    if (!rawProducts) {
        return [];
    }

    const savedProducts = JSON.parse(rawProducts);
    if (!Array.isArray(savedProducts)) {
        throw new TypeError("Saved sample products must be stored as a list.");
    }

    const seenIds = new Set();
    savedProducts.forEach(function (product) {
        const validProduct = product &&
            typeof product.id === "string" &&
            product.id.length > 0 &&
            typeof product.name === "string" &&
            typeof product.sku === "string" &&
            typeof product.category === "string" &&
            Number.isFinite(product.purchasePrice) &&
            product.purchasePrice >= 0 &&
            Number.isFinite(product.sellingPrice) &&
            product.sellingPrice >= 0 &&
            Number.isFinite(product.quantity) &&
            product.quantity >= 0 &&
            Number.isFinite(product.minimumStock) &&
            product.minimumStock >= 0 &&
            typeof product.unit === "string" &&
            !seenIds.has(product.id);
        if (!validProduct) {
            throw new TypeError("A saved sample product has an invalid shape or duplicate ID.");
        }
        seenIds.add(product.id);
    });
    return savedProducts;
}

function readSavedCategories() {
    const rawCategories = window.localStorage.getItem(categoryStorageKey);
    if (!rawCategories) {
        return [];
    }

    const savedCategories = JSON.parse(rawCategories);
    if (!Array.isArray(savedCategories)) {
        throw new TypeError("Saved sample categories must be stored as a list.");
    }
    savedCategories.forEach(function (category) {
        const validCategory = category &&
            typeof category.id === "string" &&
            typeof category.name === "string" &&
            typeof category.description === "string" &&
            Number.isInteger(category.productCount) &&
            typeof category.isActive === "boolean" &&
            typeof category.createdAt === "string" &&
            typeof category.isDeleted === "boolean";
        if (!validCategory) {
            throw new TypeError("A saved sample category has an invalid shape.");
        }
    });
    return savedCategories;
}

function loadProducts(savedProducts) {
    return seededProducts.map(function (seededProduct) {
        const savedProduct = savedProducts.find(function (product) {
            return product.id === seededProduct.id;
        });
        return savedProduct ? Object.assign({}, seededProduct, savedProduct) : Object.assign({}, seededProduct);
    }).concat(savedProducts.filter(function (savedProduct) {
        return !seededProducts.some(function (seededProduct) {
            return seededProduct.id === savedProduct.id;
        });
    }));
}

function loadCategories(savedCategories) {
    const categories = seededCategories.map(function (category) {
        return Object.assign({}, category);
    });
    savedCategories.forEach(function (savedCategory) {
        const existingIndex = categories.findIndex(function (category) {
            return category.id === savedCategory.id;
        });
        if (savedCategory.isDeleted) {
            if (existingIndex !== -1) {
                categories.splice(existingIndex, 1);
            }
            return;
        }
        if (existingIndex === -1) {
            categories.push(savedCategory);
        } else {
            categories[existingIndex] = Object.assign({}, categories[existingIndex], savedCategory);
        }
    });
    return categories;
}

function getStockStatus(product) {
    if (product.quantity <= 0) {
        return "out-of-stock";
    }
    if (product.quantity < product.minimumStock) {
        return "low-stock";
    }
    return "in-stock";
}

function getStatusLabel(status) {
    if (status === "out-of-stock") {
        return "Out of stock";
    }
    if (status === "low-stock") {
        return "Low stock";
    }
    return "In stock";
}

function showFeedback(message, isError) {
    reportFeedback.textContent = message;
    reportFeedback.classList.add("is-visible");
    reportFeedback.classList.toggle("is-error", Boolean(isError));
}

function clearFeedback() {
    reportFeedback.textContent = "";
    reportFeedback.classList.remove("is-visible", "is-error");
}

function populateCategoryFilter() {
    const categories = new Set(categoryNames);
    products.forEach(function (product) {
        categories.add(product.category);
    });
    const sortedCategories = Array.from(categories).sort(function (first, second) {
        return first.localeCompare(second);
    });
    sortedCategories.forEach(function (category) {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        reportCategoryFilter.appendChild(option);
    });
}

function createCategoryBar(category, quantity, maxQuantity) {
    const row = document.createElement("div");
    row.className = "category-chart-row";
    row.setAttribute("role", "listitem");
    row.setAttribute("aria-label", category + ": " + formatNumber(quantity) + " units");
    const label = document.createElement("span");
    label.className = "category-chart-label";
    label.textContent = category;
    const track = document.createElement("span");
    track.className = "category-chart-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.className = "category-chart-fill";
    fill.style.width = quantity > 0 ? Math.max(3, (quantity / maxQuantity) * 100) + "%" : "0%";
    track.appendChild(fill);
    const value = document.createElement("span");
    value.className = "category-chart-value";
    value.textContent = formatNumber(quantity) + " units";
    row.append(label, track, value);
    return row;
}

function renderCategoryChart() {
    const quantitiesByCategory = new Map();
    categoryNames.forEach(function (category) {
        quantitiesByCategory.set(category, 0);
    });
    products.forEach(function (product) {
        quantitiesByCategory.set(
            product.category,
            (quantitiesByCategory.get(product.category) || 0) + product.quantity
        );
    });
    const categories = Array.from(quantitiesByCategory.entries()).sort(function (first, second) {
        return second[1] - first[1] || first[0].localeCompare(second[0]);
    });
    const maxQuantity = categories.reduce(function (maximum, entry) {
        return Math.max(maximum, entry[1]);
    }, 1);
    categoryChart.replaceChildren(...categories.map(function (entry) {
        return createCategoryBar(entry[0], entry[1], maxQuantity);
    }));
    categoryChart.hidden = categories.length === 0;
    categoryChartEmpty.hidden = categories.length > 0;
}

function createHealthRow(status, count, total) {
    const row = document.createElement("div");
    row.className = "health-row";
    const label = document.createElement("span");
    label.className = "health-label";
    const dot = document.createElement("span");
    dot.className = "health-dot " + status;
    dot.setAttribute("aria-hidden", "true");
    label.append(dot, document.createTextNode(getStatusLabel(status)));
    const track = document.createElement("span");
    track.className = "health-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.className = "health-fill " + status;
    fill.style.width = total > 0 ? (count / total) * 100 + "%" : "0%";
    track.appendChild(fill);
    const countLabel = document.createElement("strong");
    countLabel.className = "health-count";
    countLabel.textContent = String(count);
    row.append(label, track, countLabel);
    return row;
}

function renderStockHealth() {
    const counts = {
        "in-stock": 0,
        "low-stock": 0,
        "out-of-stock": 0
    };
    products.forEach(function (product) {
        counts[getStockStatus(product)] += 1;
    });
    reportStats.healthTotal.textContent = String(products.length);
    healthRows.replaceChildren(
        createHealthRow("in-stock", counts["in-stock"], products.length),
        createHealthRow("low-stock", counts["low-stock"], products.length),
        createHealthRow("out-of-stock", counts["out-of-stock"], products.length)
    );
}

function createReportRow(product) {
    const status = getStockStatus(product);
    const row = document.createElement("tr");
    const identityCell = document.createElement("td");
    const identity = document.createElement("span");
    identity.className = "report-product-cell";
    const name = document.createElement("strong");
    name.textContent = product.name;
    const sku = document.createElement("small");
    sku.textContent = product.sku;
    identity.append(name, sku);
    identityCell.appendChild(identity);
    row.appendChild(identityCell);

    const categoryCell = document.createElement("td");
    categoryCell.textContent = product.category;
    row.appendChild(categoryCell);

    const quantityCell = document.createElement("td");
    quantityCell.textContent = formatNumber(product.quantity) + " " + product.unit.toLowerCase();
    row.appendChild(quantityCell);

    const reorderCell = document.createElement("td");
    reorderCell.textContent = formatNumber(product.minimumStock) + " " + product.unit.toLowerCase();
    row.appendChild(reorderCell);

    const costCell = document.createElement("td");
    costCell.textContent = formatCurrency(product.purchasePrice);
    row.appendChild(costCell);

    const stockValueCell = document.createElement("td");
    stockValueCell.className = "report-stock-value";
    stockValueCell.textContent = formatCurrency(product.quantity * product.purchasePrice);
    row.appendChild(stockValueCell);

    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = "report-status " + status;
    statusBadge.textContent = getStatusLabel(status);
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);
    return row;
}

function getFilteredProducts() {
    const query = reportSearch.value.trim().toLowerCase();
    const category = reportCategoryFilter.value;
    const status = reportStockFilter.value;
    return products.filter(function (product) {
        const matchesText = !query ||
            product.name.toLowerCase().includes(query) ||
            product.sku.toLowerCase().includes(query);
        const matchesCategory = !category || product.category === category;
        const matchesStatus = !status || getStockStatus(product) === status;
        return matchesText && matchesCategory && matchesStatus;
    });
}

function renderProductRows() {
    const visibleProducts = getFilteredProducts();
    reportRows.replaceChildren(...visibleProducts.map(createReportRow));
    reportEmpty.hidden = visibleProducts.length > 0;
    reportResults.textContent = "Showing " + visibleProducts.length + " of " + products.length + " products";
}

function renderSummary() {
    const units = products.reduce(function (total, product) {
        return total + product.quantity;
    }, 0);
    const inventoryValue = products.reduce(function (total, product) {
        return total + product.quantity * product.purchasePrice;
    }, 0);
    const attention = products.filter(function (product) {
        return getStockStatus(product) !== "in-stock";
    }).length;
    reportStats.products.textContent = String(products.length);
    reportStats.units.textContent = formatNumber(units);
    reportStats.value.textContent = formatCurrency(inventoryValue);
    reportStats.attention.textContent = String(attention);
}

function csvCell(value) {
    let text = String(value);
    if (/^[\t\r=+\-@]/.test(text)) {
        text = "'" + text;
    }
    return '"' + text.replace(/"/g, '""') + '"';
}

function exportCsv() {
    if (!storageReady) {
        showFeedback("The report cannot be exported until saved sample data is available.", true);
        return;
    }
    const headers = [
        "Product",
        "SKU",
        "Category",
        "Quantity",
        "Unit",
        "Reorder level",
        "Unit cost",
        "Stock value",
        "Selling price",
        "Status"
    ];
    const rows = getFilteredProducts().map(function (product) {
        return [
            product.name,
            product.sku,
            product.category,
            product.quantity,
            product.unit,
            product.minimumStock,
            product.purchasePrice.toFixed(2),
            (product.quantity * product.purchasePrice).toFixed(2),
            product.sellingPrice.toFixed(2),
            getStatusLabel(getStockStatus(product))
        ];
    });
    const csv = [headers, ...rows].map(function (row) {
        return row.map(csvCell).join(",");
    }).join("\r\n");
    try {
        const file = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
        const fileUrl = URL.createObjectURL(file);
        const downloadLink = document.createElement("a");
        downloadLink.href = fileUrl;
        downloadLink.download = "smartstock-inventory-report.csv";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.setTimeout(function () {
            URL.revokeObjectURL(fileUrl);
        }, 0);
        clearFeedback();
    } catch (error) {
        console.error("Could not export the inventory report.", error);
        showFeedback("The report could not be exported in this browser. Try again or check browser download settings.", true);
    }
}

function showStorageWarning(error) {
    storageReady = false;
    console.error("Could not load sample inventory report data.", error);
    reportStorageWarning.textContent = "Saved product or category data could not be loaded. The report is showing seed data and export is disabled. Clear the SmartStock sample data in browser storage and refresh.";
    reportStorageWarning.hidden = false;
    exportReportButton.disabled = true;
}

if (document.body.dataset.demo === "false") {
    products = JSON.parse(document.querySelector("#reportProducts").textContent);
    categoryNames = JSON.parse(document.querySelector("#reportCategories").textContent);
} else {
    try {
        const savedProducts = readSavedProducts();
        const savedCategories = readSavedCategories();
        products = loadProducts(savedProducts);
        categoryNames = loadCategories(savedCategories).filter(function (category) {
            return category.isActive;
        }).map(function (category) {
            return category.name;
        });
        products.forEach(function (product) {
            if (!categoryNames.includes(product.category)) {
                categoryNames.push(product.category);
            }
        });
    } catch (error) {
        showStorageWarning(error);
        products = loadProducts([]);
        categoryNames = seededCategories.filter(function (category) {
            return category.isActive;
        }).map(function (category) {
            return category.name;
        });
    }
}

populateCategoryFilter();
renderSummary();
renderCategoryChart();
renderStockHealth();
renderProductRows();

reportSearch.addEventListener("input", renderProductRows);
reportCategoryFilter.addEventListener("change", renderProductRows);
reportStockFilter.addEventListener("change", renderProductRows);
exportReportButton.addEventListener("click", exportCsv);

const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebarToggle");
const sidebarScrim = document.querySelector("#sidebarScrim");
const notificationButton = document.querySelector("#notificationButton");
const notificationPopover = document.querySelector("#notificationPopover");
sidebarToggle.addEventListener("click", function () {
    const isOpen = !sidebar.classList.contains("is-open");
    sidebar.classList.toggle("is-open", isOpen);
    sidebarScrim.classList.toggle("is-open", isOpen);
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});
sidebarScrim.addEventListener("click", function () {
    sidebar.classList.remove("is-open");
    sidebarScrim.classList.remove("is-open");
    sidebarToggle.setAttribute("aria-expanded", "false");
    sidebarToggle.setAttribute("aria-label", "Open navigation");
});
sidebar.addEventListener("click", function (event) {
    if (event.target.closest(".nav-link") && window.matchMedia("(max-width: 980px)").matches) {
        sidebar.classList.remove("is-open");
        sidebarScrim.classList.remove("is-open");
        sidebarToggle.setAttribute("aria-expanded", "false");
        sidebarToggle.setAttribute("aria-label", "Open navigation");
    }
});
notificationButton.addEventListener("click", function () {
    const isExpanded = notificationButton.getAttribute("aria-expanded") === "true";
    notificationButton.setAttribute("aria-expanded", String(!isExpanded));
    notificationPopover.hidden = isExpanded;
});
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        sidebar.classList.remove("is-open");
        sidebarScrim.classList.remove("is-open");
        sidebarToggle.setAttribute("aria-expanded", "false");
        sidebarToggle.setAttribute("aria-label", "Open navigation");
        notificationButton.setAttribute("aria-expanded", "false");
        notificationPopover.hidden = true;
    }
});
