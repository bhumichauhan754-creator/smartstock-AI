"use strict";

const sampleProductStorageKey = "smartstock.sampleProducts";
const productSearch = document.querySelector("#productSearch");
const categoryFilter = document.querySelector("#categoryFilter");
const stockFilter = document.querySelector("#stockFilter");
const productRowsContainer = document.querySelector("#productRows");
const isDemo = productRowsContainer.dataset.demo !== "false";
if (!isDemo) {
    productRowsContainer.querySelectorAll("tr").forEach(function (row) {
        row.remove();
    });
    const serverRowsTemplate = document.querySelector("#serverProductRows");
    if (serverRowsTemplate) {
        productRowsContainer.appendChild(serverRowsTemplate.content.cloneNode(true));
    }
    const serverCategoriesTemplate = document.querySelector("#serverProductCategories");
    if (serverCategoriesTemplate) {
        const categoryPlaceholder = categoryFilter.options[0].cloneNode(true);
        categoryFilter.replaceChildren(categoryPlaceholder);
        categoryFilter.appendChild(serverCategoriesTemplate.content.cloneNode(true));
    }
}
let productRows = Array.from(productRowsContainer.querySelectorAll("tr"));
const productCount = document.querySelector("#productCount");
const inStockCount = document.querySelector("#inStockCount");
const lowStockCount = document.querySelector("#lowStockCount");
const outOfStockCount = document.querySelector("#outOfStockCount");
const resultsSummary = document.querySelector("#resultsSummary");
const emptyProducts = document.querySelector("#emptyProducts");
const storageWarning = document.querySelector("#storageWarning");
const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebarToggle");
const sidebarScrim = document.querySelector("#sidebarScrim");
const notificationButton = document.querySelector("#notificationButton");
const notificationPopover = document.querySelector("#notificationPopover");

function readSavedProducts() {
    const rawProducts = window.localStorage.getItem(sampleProductStorageKey);
    if (!rawProducts) {
        return [];
    }

    const savedProducts = JSON.parse(rawProducts);
    if (!Array.isArray(savedProducts)) {
        throw new TypeError("Saved sample products must be stored as a list.");
    }

    savedProducts.forEach(function (product) {
        const validProduct = product &&
            typeof product.id === "string" &&
            typeof product.name === "string" &&
            typeof product.sku === "string" &&
            typeof product.category === "string" &&
            Number.isFinite(product.purchasePrice) &&
            Number.isFinite(product.sellingPrice) &&
            Number.isFinite(product.quantity) &&
            Number.isFinite(product.minimumStock) &&
            typeof product.unit === "string";

        if (!validProduct) {
            throw new TypeError("A saved sample product has an invalid shape.");
        }
    });

    return savedProducts;
}

function createActionIcon(pathData, strokeWidth) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("d", pathData);
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", strokeWidth);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
}

function createCell(content, className) {
    const cell = document.createElement("td");
    if (className) {
        cell.className = className;
    }
    if (content instanceof Node) {
        cell.appendChild(content);
    } else {
        cell.textContent = content;
    }
    return cell;
}

function getStockStatus(quantity, minimumStock) {
    if (quantity <= 0) {
        return "out-of-stock";
    }
    if (quantity < minimumStock) {
        return "low-stock";
    }
    return "in-stock";
}

function formatPrice(price) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(price);
}

function createSavedProductRow(product) {
    const stockStatus = getStockStatus(product.quantity, product.minimumStock);
    const row = document.createElement("tr");
    row.dataset.name = product.name.toLowerCase();
    row.dataset.sku = product.sku.toLowerCase();
    row.dataset.category = product.category.toLowerCase();
    row.dataset.stock = stockStatus;
    row.dataset.productId = product.id;
    row.dataset.storageId = product.id;

    const identity = document.createElement("div");
    identity.className = "product-identity";
    const thumbnail = document.createElement("span");
    thumbnail.className = "product-thumb thumb-blue";
    thumbnail.setAttribute("role", "img");
    thumbnail.setAttribute("aria-label", product.name + " image");

    if (typeof product.imageData === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(product.imageData)) {
        const image = document.createElement("img");
        image.src = product.imageData;
        image.alt = "";
        thumbnail.appendChild(image);
    } else {
        thumbnail.textContent = product.name.slice(0, 1).toUpperCase();
    }

    const identityText = document.createElement("span");
    const productName = document.createElement("strong");
    const productSku = document.createElement("small");
    productName.textContent = product.name;
    productSku.textContent = product.sku;
    identityText.append(productName, productSku);
    identity.append(thumbnail, identityText);
    row.appendChild(createCell(identity));

    const category = document.createElement("span");
    category.className = "category-tag";
    category.textContent = product.category;
    row.appendChild(createCell(category));
    row.appendChild(createCell(formatPrice(product.purchasePrice)));
    row.appendChild(createCell(formatPrice(product.sellingPrice), "price-emphasis"));

    const stock = document.createElement("div");
    const quantity = document.createElement("strong");
    const minimum = document.createElement("small");
    quantity.className = "stock-quantity";
    minimum.className = "stock-minimum";
    quantity.textContent = String(product.quantity) + " " + product.unit.toLowerCase();
    minimum.textContent = "Min. " + product.minimumStock + " " + product.unit.toLowerCase();
    stock.append(quantity, minimum);
    row.appendChild(createCell(stock));

    const status = document.createElement("span");
    status.className = "product-status " + stockStatus;
    const statusDot = document.createElement("i");
    status.append(statusDot, document.createTextNode(
        stockStatus === "in-stock" ? "In stock" : stockStatus === "low-stock" ? "Low stock" : "Out of stock"
    ));
    row.appendChild(createCell(status));

    const actions = document.createElement("div");
    actions.className = "row-actions";
    const editLink = document.createElement("a");
    editLink.className = "row-action edit-action";
    editLink.href = "/products/" + encodeURIComponent(product.id) + "/edit/";
    editLink.setAttribute("aria-label", "Edit " + product.name);
    editLink.appendChild(createActionIcon("m12.8 4.2 3 3M4 16l3.7-.8L16 6.9a1.8 1.8 0 0 0-2.6-2.6L5 12.7 4 16Z", "1.5"));

    const deleteButton = document.createElement("button");
    deleteButton.className = "row-action delete-action";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", "Delete " + product.name);
    deleteButton.appendChild(createActionIcon("M4.5 6h11m-9.5 0 .6 10h7.8L15 6m-7-2h4l.7 2H7.3L8 4Zm.8 5v4m2.4-4v4", "1.4"));
    actions.append(editLink, deleteButton);
    row.appendChild(createCell(actions));
    return row;
}

function showStorageWarning(message, error) {
    console.error(message, error);
    storageWarning.textContent = message;
    storageWarning.hidden = false;
}

function loadSavedProducts() {
    let savedProducts;
    try {
        savedProducts = readSavedProducts();
    } catch (error) {
        showStorageWarning("Saved sample products could not be loaded. Clear the SmartStock sample data from this browser’s storage and refresh.", error);
        return;
    }

    savedProducts.forEach(function (product) {
        const row = createSavedProductRow(product);
        const existingRow = productRows.find(function (productRow) {
            return productRow.dataset.productId === product.id;
        });

        if (existingRow) {
            existingRow.replaceWith(row);
        } else {
            productRowsContainer.appendChild(row);
        }
    });
    productRows = Array.from(productRowsContainer.querySelectorAll("tr"));
}

function filterProducts() {
    const query = productSearch.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const stock = stockFilter.value;
    let visibleCount = 0;

    productRows.forEach(function (row) {
        const matchesText = row.dataset.name.includes(query) || row.dataset.sku.includes(query);
        const matchesCategory = !category || row.dataset.category === category;
        const matchesStock = !stock || row.dataset.stock === stock;
        const isVisible = matchesText && matchesCategory && matchesStock;

        row.hidden = !isVisible;
        if (isVisible) {
            visibleCount += 1;
        }
    });

    productCount.textContent = String(productRows.length);
    inStockCount.textContent = String(countProductsByStock("in-stock"));
    lowStockCount.textContent = String(countProductsByStock("low-stock"));
    outOfStockCount.textContent = String(countProductsByStock("out-of-stock"));
    resultsSummary.textContent = visibleCount > 0
        ? "Showing 1–" + visibleCount + " of " + productRows.length + " products"
        : "Showing 0 of " + productRows.length + " products";
    emptyProducts.hidden = visibleCount > 0;
}

function countProductsByStock(status) {
    return productRows.filter(function (row) {
        return row.dataset.stock === status;
    }).length;
}

function setSidebarOpen(isOpen) {
    sidebar.classList.toggle("is-open", isOpen);
    sidebarScrim.classList.toggle("is-open", isOpen);
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

function removeSavedProductFromStorage(id) {
    const savedProducts = readSavedProducts();
    const updatedProducts = savedProducts.filter(function (product) {
        return product.id !== id;
    });

    if (updatedProducts.length === savedProducts.length) {
        throw new Error("The saved product was not found in browser storage.");
    }

    window.localStorage.setItem(sampleProductStorageKey, JSON.stringify(updatedProducts));
}

function confirmProductDeletion(button) {
    const row = button.closest("tr");
    const productName = row.querySelector(".product-identity strong").textContent;

    const prompt = row.dataset.serverProduct === "true"
        ? "Delete " + productName + " from your product catalog?"
        : "Remove " + productName + " from this sample product list?";
    if (!window.confirm(prompt)) {
        return false;
    }

    if (row.dataset.serverProduct === "true") {
        return true;
    }

    if (row.dataset.storageId) {
        try {
            removeSavedProductFromStorage(row.dataset.storageId);
        } catch (error) {
            showStorageWarning("This sample product could not be removed from browser storage. Refresh and try again.", error);
            return false;
        }
    }

    row.remove();
    productRows = productRows.filter(function (productRow) {
        return productRow !== row;
    });
    filterProducts();
    return true;
}

productSearch.addEventListener("input", filterProducts);
categoryFilter.addEventListener("change", filterProducts);
stockFilter.addEventListener("change", filterProducts);

productRowsContainer.addEventListener("click", function (event) {
    const deleteButton = event.target.closest(".delete-action");
    if (deleteButton && !confirmProductDeletion(deleteButton)) {
        event.preventDefault();
    }
});

sidebarToggle.addEventListener("click", function () {
    setSidebarOpen(!sidebar.classList.contains("is-open"));
});

sidebarScrim.addEventListener("click", function () {
    setSidebarOpen(false);
});

sidebar.addEventListener("click", function (event) {
    if (event.target.closest(".nav-link") && window.matchMedia("(max-width: 980px)").matches) {
        setSidebarOpen(false);
    }
});

notificationButton.addEventListener("click", function () {
    const isExpanded = notificationButton.getAttribute("aria-expanded") === "true";
    notificationButton.setAttribute("aria-expanded", String(!isExpanded));
    notificationPopover.hidden = isExpanded;
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        setSidebarOpen(false);
        notificationButton.setAttribute("aria-expanded", "false");
        notificationPopover.hidden = true;
    }
});

if (isDemo) {
    loadSavedProducts();
}
filterProducts();
