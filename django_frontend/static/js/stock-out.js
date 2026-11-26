"use strict";

const sampleProductStorageKey = "smartstock.sampleProducts";
const stockIssueStorageKey = "smartstock.sampleStockIssues";
const seededProducts = [
    { id: "1", name: "Wireless Headphones", sku: "ELEC-001", category: "Electronics", purchasePrice: 42, sellingPrice: 79, quantity: 86, minimumStock: 20, unit: "Units", imageData: "", description: "" },
    { id: "2", name: "USB-C Hub", sku: "ACC-014", category: "Accessories", purchasePrice: 18.5, sellingPrice: 34.99, quantity: 8, minimumStock: 15, unit: "Units", imageData: "", description: "" },
    { id: "3", name: "Ergonomic Office Chair", sku: "FURN-008", category: "Furniture", purchasePrice: 118, sellingPrice: 219, quantity: 24, minimumStock: 10, unit: "Units", imageData: "", description: "" },
    { id: "4", name: "Wireless Mouse", sku: "ACC-023", category: "Accessories", purchasePrice: 12, sellingPrice: 24.99, quantity: 142, minimumStock: 30, unit: "Units", imageData: "", description: "" },
    { id: "5", name: "Mechanical Keyboard", sku: "ELEC-032", category: "Electronics", purchasePrice: 56, sellingPrice: 99, quantity: 6, minimumStock: 12, unit: "Units", imageData: "", description: "" },
    { id: "6", name: "Desk Organizer Set", sku: "OFF-019", category: "Office supplies", purchasePrice: 8.5, sellingPrice: 17.99, quantity: 54, minimumStock: 15, unit: "Units", imageData: "", description: "" },
    { id: "7", name: "Bluetooth Speaker", sku: "ELEC-041", category: "Electronics", purchasePrice: 29, sellingPrice: 54, quantity: 0, minimumStock: 10, unit: "Units", imageData: "", description: "" },
    { id: "8", name: "Notebook Multipack", sku: "OFF-027", category: "Office supplies", purchasePrice: 5, sellingPrice: 11.5, quantity: 210, minimumStock: 40, unit: "Units", imageData: "", description: "" }
];
const stockOutForm = document.querySelector("#stockOutForm");
const demoMode = stockOutForm.dataset.demo !== "false";
const outReferenceInput = document.querySelector("#outReference");
const issueDateInput = document.querySelector("#issueDate");
const reasonInput = document.querySelector("#issueReason");
const destinationInput = document.querySelector("#issueDestination");
const outNotesInput = document.querySelector("#outNotes");
const outLines = document.querySelector("#outLines");
const stockOutTotal = document.querySelector("#stockOutTotal");
const stockOutMessage = document.querySelector("#stockOutMessage");
const addOutLineButton = document.querySelector("#addOutLine");
const stockOutSaveButton = stockOutForm.querySelector("button[type='submit']");
const recentOutRows = document.querySelector("#recentOutRows");
const recentOutEmpty = document.querySelector("#recentOutEmpty");
const issuedToday = document.querySelector("#issuedToday");
const outEntriesToday = document.querySelector("#outEntriesToday");
const latestOutReference = document.querySelector("#latestOutReference");
let availableProducts = [];
let stockIssues = [];
let storageReady = true;
let lineNumber = 0;

function getLocalDateValue(date) {
    const localDate = date || new Date();
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
}

function createReference() {
    const timestamp = Date.now().toString(36).toUpperCase();
    return "OUT-" + getLocalDateValue().replace(/-/g, "") + "-" + timestamp.slice(-5);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(value);
}

function showMessage(message, isError) {
    stockOutMessage.textContent = message;
    stockOutMessage.classList.add("is-visible");
    stockOutMessage.classList.toggle("is-error", Boolean(isError));
}

function clearMessage() {
    stockOutMessage.textContent = "";
    stockOutMessage.classList.remove("is-visible", "is-error");
}

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

function readStockIssues() {
    const rawIssues = window.localStorage.getItem(stockIssueStorageKey);
    if (!rawIssues) {
        return [];
    }

    const savedIssues = JSON.parse(rawIssues);
    if (!Array.isArray(savedIssues)) {
        throw new TypeError("Saved sample stock issues must be stored as a list.");
    }

    savedIssues.forEach(function (issue) {
        const validIssue = issue &&
            typeof issue.reference === "string" &&
            typeof issue.issueDate === "string" &&
            typeof issue.createdAt === "string" &&
            typeof issue.reason === "string" &&
            Array.isArray(issue.items) &&
            issue.items.every(function (item) {
                return item &&
                    typeof item.productId === "string" &&
                    typeof item.name === "string" &&
                    Number.isFinite(item.quantity) &&
                    Number.isFinite(item.unitValue) &&
                    Number.isFinite(item.subtotal);
            }) &&
            Number.isFinite(issue.total);

        if (!validIssue) {
            throw new TypeError("A saved sample stock issue has an invalid shape.");
        }
    });

    return savedIssues;
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

function createLineRow() {
    lineNumber += 1;
    const row = document.createElement("tr");
    row.dataset.lineNumber = String(lineNumber);

    const productCell = document.createElement("td");
    const productSelect = document.createElement("select");
    productSelect.className = "stock-product-select";
    productSelect.name = "product_id";
    productSelect.setAttribute("aria-label", "Product for issue line " + lineNumber);
    productSelect.required = true;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a product";
    productSelect.appendChild(placeholder);

    availableProducts.forEach(function (product) {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = product.name + " (" + product.sku + ") · " +
            product.quantity + " " + product.unit.toLowerCase() + " available";
        productSelect.appendChild(option);
    });
    productCell.appendChild(productSelect);

    const quantityCell = document.createElement("td");
    const quantityInput = document.createElement("input");
    quantityInput.className = "stock-line-input";
    quantityInput.name = "quantity";
    quantityInput.type = "number";
    quantityInput.min = "0.001";
    quantityInput.step = "any";
    quantityInput.placeholder = "0";
    quantityInput.setAttribute("aria-label", "Quantity for issue line " + lineNumber);
    quantityInput.required = true;
    quantityCell.appendChild(quantityInput);

    const valueCell = document.createElement("td");
    const valueInput = document.createElement("input");
    valueInput.className = "stock-line-input";
    valueInput.name = "unit_value";
    valueInput.type = "number";
    valueInput.min = "0";
    valueInput.step = "0.01";
    valueInput.placeholder = "0.00";
    valueInput.setAttribute("aria-label", "Unit value for issue line " + lineNumber);
    valueInput.required = true;
    valueCell.appendChild(valueInput);

    const totalCell = document.createElement("td");
    const total = document.createElement("span");
    total.className = "stock-line-total";
    total.textContent = formatCurrency(0);
    totalCell.appendChild(total);

    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.className = "remove-stock-line";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", "Remove issue line " + lineNumber);
    removeButton.textContent = "×";
    actionCell.appendChild(removeButton);

    row.append(productCell, quantityCell, valueCell, totalCell, actionCell);
    return row;
}

function updateRemoveButtons() {
    const rows = Array.from(outLines.querySelectorAll("tr"));
    rows.forEach(function (row) {
        row.querySelector(".remove-stock-line").disabled = rows.length === 1;
    });
}

function addLine() {
    outLines.appendChild(createLineRow());
    updateRemoveButtons();
}

function getLineValues(row) {
    const productId = row.querySelector(".stock-product-select").value;
    const quantity = Number(row.querySelector("[name='quantity']").value);
    const unitValue = Number(row.querySelector("[name='unit_value']").value);
    const product = availableProducts.find(function (item) {
        return item.id === productId;
    });

    return { product: product, quantity: quantity, unitValue: unitValue };
}

function updateLineTotal(row) {
    const values = getLineValues(row);
    const lineTotal = Number.isFinite(values.quantity) && values.quantity > 0 &&
        Number.isFinite(values.unitValue) && values.unitValue >= 0
        ? values.quantity * values.unitValue
        : 0;
    row.querySelector(".stock-line-total").textContent = formatCurrency(lineTotal);

    const total = Array.from(outLines.querySelectorAll("tr")).reduce(function (sum, line) {
        const lineValues = getLineValues(line);
        if (!Number.isFinite(lineValues.quantity) || lineValues.quantity <= 0 ||
            !Number.isFinite(lineValues.unitValue) || lineValues.unitValue < 0) {
            return sum;
        }
        return sum + lineValues.quantity * lineValues.unitValue;
    }, 0);
    stockOutTotal.textContent = formatCurrency(total);
}

function renderRecentIssues() {
    const sortedIssues = stockIssues.slice().sort(function (first, second) {
        return second.createdAt.localeCompare(first.createdAt);
    });
    recentOutRows.replaceChildren();

    sortedIssues.slice(0, 5).forEach(function (issue) {
        const row = document.createElement("tr");
        [
            issue.reference,
            issue.reason,
            new Date(issue.issueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            String(issue.items.length),
            formatCurrency(issue.total)
        ].forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        recentOutRows.appendChild(row);
    });
    recentOutEmpty.hidden = sortedIssues.length > 0;

    const today = getLocalDateValue();
    const todaysIssues = stockIssues.filter(function (issue) {
        return issue.issueDate === today;
    });
    issuedToday.textContent = String(todaysIssues.reduce(function (total, issue) {
        return total + issue.items.reduce(function (itemTotal, item) {
            return itemTotal + item.quantity;
        }, 0);
    }, 0));
    outEntriesToday.textContent = String(todaysIssues.length);
    latestOutReference.textContent = sortedIssues.length ? sortedIssues[0].reference : "No entries yet";
}

function validateIssueLines() {
    let firstInvalidControl = null;
    const rows = Array.from(outLines.querySelectorAll("tr"));
    const seenProductIds = new Set();
    let duplicateProduct = false;
    let insufficientStock = "";

    rows.forEach(function (row) {
        const productSelect = row.querySelector(".stock-product-select");
        const quantityInput = row.querySelector("[name='quantity']");
        const valueInput = row.querySelector("[name='unit_value']");
        const productId = productSelect.value;
        const product = availableProducts.find(function (item) {
            return item.id === productId;
        });
        const quantity = Number(quantityInput.value);

        if (!productId || !productSelect.checkValidity()) {
            productSelect.setAttribute("aria-invalid", "true");
            firstInvalidControl = firstInvalidControl || productSelect;
        } else {
            productSelect.removeAttribute("aria-invalid");
        }

        if (!quantityInput.value || !quantityInput.checkValidity() ||
            (product && quantity > product.quantity)) {
            quantityInput.setAttribute("aria-invalid", "true");
            firstInvalidControl = firstInvalidControl || quantityInput;
            if (product && quantity > product.quantity) {
                insufficientStock = product.name + " has " + product.quantity + " " +
                    product.unit.toLowerCase() + " available; reduce the issue quantity.";
            }
        } else {
            quantityInput.removeAttribute("aria-invalid");
        }

        if (valueInput.value === "" || !valueInput.checkValidity()) {
            valueInput.setAttribute("aria-invalid", "true");
            firstInvalidControl = firstInvalidControl || valueInput;
        } else {
            valueInput.removeAttribute("aria-invalid");
        }

        if (productId && seenProductIds.has(productId)) {
            productSelect.setAttribute("aria-invalid", "true");
            firstInvalidControl = firstInvalidControl || productSelect;
            duplicateProduct = true;
        }
        if (productId) {
            seenProductIds.add(productId);
        }
    });

    if (insufficientStock) {
        showMessage(insufficientStock, true);
    } else if (duplicateProduct) {
        showMessage("Choose each product only once. Combine the issued quantity on its product line.", true);
    }

    if (firstInvalidControl) {
        firstInvalidControl.focus();
        return false;
    }
    return !duplicateProduct && !insufficientStock;
}

function buildIssue() {
    const items = Array.from(outLines.querySelectorAll("tr")).map(function (row) {
        const values = getLineValues(row);
        return {
            productId: values.product.id,
            name: values.product.name,
            sku: values.product.sku,
            quantity: values.quantity,
            unit: values.product.unit,
            unitValue: values.unitValue,
            subtotal: values.quantity * values.unitValue
        };
    });

    return {
        id: "issue-" + Date.now().toString(36),
        reference: outReferenceInput.value.trim(),
        issueDate: issueDateInput.value,
        reason: reasonInput.value,
        destination: destinationInput.value.trim(),
        notes: outNotesInput.value.trim(),
        items: items,
        total: items.reduce(function (total, item) {
            return total + item.subtotal;
        }, 0),
        createdAt: new Date().toISOString()
    };
}

function updateProductQuantities(savedProducts, issue) {
    const updatedProducts = savedProducts.slice();
    issue.items.forEach(function (item) {
        const savedIndex = updatedProducts.findIndex(function (product) {
            return product.id === item.productId;
        });
        const baseProduct = savedIndex === -1
            ? availableProducts.find(function (product) {
                return product.id === item.productId;
            })
            : updatedProducts[savedIndex];
        const updatedProduct = Object.assign({}, baseProduct, {
            quantity: baseProduct.quantity - item.quantity
        });

        if (updatedProduct.quantity < 0) {
            throw new RangeError("The issue would reduce available stock below zero.");
        }

        if (savedIndex === -1) {
            updatedProducts.push(updatedProduct);
        } else {
            updatedProducts[savedIndex] = updatedProduct;
        }
    });
    return updatedProducts;
}

function restoreStorageValue(key, previousValue) {
    if (previousValue === null) {
        window.localStorage.removeItem(key);
    } else {
        window.localStorage.setItem(key, previousValue);
    }
}

function persistIssue(issue) {
    const previousProducts = window.localStorage.getItem(sampleProductStorageKey);
    const previousIssues = window.localStorage.getItem(stockIssueStorageKey);
    const savedProducts = readSavedProducts();
    const savedIssues = readStockIssues();
    const updatedProducts = updateProductQuantities(savedProducts, issue);
    const updatedIssues = savedIssues.concat(issue);
    let productsWritten = false;

    try {
        window.localStorage.setItem(sampleProductStorageKey, JSON.stringify(updatedProducts));
        productsWritten = true;
        window.localStorage.setItem(stockIssueStorageKey, JSON.stringify(updatedIssues));
    } catch (error) {
        if (productsWritten) {
            try {
                restoreStorageValue(sampleProductStorageKey, previousProducts);
            } catch (rollbackError) {
                console.error("Could not roll back product quantities after the stock issue failed to save.", rollbackError);
            }
        }
        throw error;
    }
}

function handleStockOutSubmit(event) {
    if (stockOutForm.dataset.demo !== "true") {
        if (!stockOutForm.checkValidity()) {
            event.preventDefault();
            stockOutForm.reportValidity();
        }
        return;
    }

    event.preventDefault();
    clearMessage();

    if (!storageReady) {
        showMessage("Sample inventory data is unavailable. Clear the SmartStock sample data in browser storage and refresh.", true);
        return;
    }

    if (!validateIssueLines()) {
        return;
    }
    if (!stockOutForm.checkValidity()) {
        stockOutForm.reportValidity();
        return;
    }

    const reference = outReferenceInput.value.trim().toLowerCase();
    if (stockIssues.some(function (issue) {
        return issue.reference.toLowerCase() === reference;
    })) {
        outReferenceInput.setAttribute("aria-invalid", "true");
        outReferenceInput.focus();
        showMessage("This reference number has already been used. Enter a unique reference.", true);
        return;
    }
    outReferenceInput.removeAttribute("aria-invalid");

    const issue = buildIssue();
    try {
        persistIssue(issue);
    } catch (error) {
        console.error("Could not save the sample stock issue.", error);
        showMessage("The stock issue could not be saved in browser storage. Check available storage and try again.", true);
        return;
    }

    stockIssues = stockIssues.concat(issue);
    availableProducts = loadProducts(readSavedProducts());
    renderRecentIssues();
    showMessage("Stock issue " + issue.reference + " saved. Product quantities have been updated.", false);
    stockOutForm.reset();
    outReferenceInput.value = createReference();
    issueDateInput.value = getLocalDateValue();
    outLines.replaceChildren();
    lineNumber = 0;
    addLine();
    stockOutTotal.textContent = formatCurrency(0);
}

function setSidebarOpen(isOpen) {
    sidebar.classList.toggle("is-open", isOpen);
    sidebarScrim.classList.toggle("is-open", isOpen);
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

function disableStockEntry(message, error) {
    storageReady = false;
    console.error(message, error);
    showMessage(message, true);
    addOutLineButton.disabled = true;
    stockOutSaveButton.disabled = true;
}

if (!demoMode) {
    availableProducts = JSON.parse(document.querySelector("#stockOutProducts").textContent);
    stockIssues = JSON.parse(document.querySelector("#stockIssues").textContent);
    renderRecentIssues();
    const summary = JSON.parse(document.querySelector("#stockOutSummary").textContent);
    issuedToday.textContent = String(summary.quantityToday);
    outEntriesToday.textContent = String(summary.entriesToday);
    latestOutReference.textContent = summary.latestReference || "No entries yet";
} else {
    try {
        const savedProducts = readSavedProducts();
        stockIssues = readStockIssues();
        availableProducts = loadProducts(savedProducts);
        renderRecentIssues();
    } catch (error) {
        disableStockEntry("Saved sample inventory could not be loaded. Clear the SmartStock sample data in browser storage and refresh.", error);
        availableProducts = seededProducts.map(function (product) {
            return Object.assign({}, product);
        });
    }
}

outReferenceInput.value = createReference();
issueDateInput.value = getLocalDateValue();
addLine();

addOutLineButton.addEventListener("click", function () {
    if (storageReady) {
        addLine();
    }
});

outLines.addEventListener("click", function (event) {
    const removeButton = event.target.closest(".remove-stock-line");
    if (!removeButton || removeButton.disabled) {
        return;
    }
    removeButton.closest("tr").remove();
    updateRemoveButtons();
    stockOutTotal.textContent = formatCurrency(Array.from(outLines.querySelectorAll("tr")).reduce(function (total, row) {
        const values = getLineValues(row);
        return total + (values.quantity > 0 && values.unitValue >= 0 ? values.quantity * values.unitValue : 0);
    }, 0));
});

outLines.addEventListener("change", function (event) {
    const row = event.target.closest("tr");
    if (!row) {
        return;
    }

    if (event.target.matches(".stock-product-select")) {
        const product = availableProducts.find(function (item) {
            return item.id === event.target.value;
        });
        const quantityInput = row.querySelector("[name='quantity']");
        const valueInput = row.querySelector("[name='unit_value']");
        quantityInput.max = product ? String(product.quantity) : "";
        valueInput.value = product ? String(product.sellingPrice) : "";
        event.target.removeAttribute("aria-invalid");
    } else if (event.target.matches(".stock-line-input")) {
        event.target.removeAttribute("aria-invalid");
    }
    updateLineTotal(row);
});

outLines.addEventListener("input", function (event) {
    const row = event.target.closest("tr");
    if (row && event.target.matches(".stock-line-input")) {
        event.target.removeAttribute("aria-invalid");
        updateLineTotal(row);
    }
});

if (demoMode) {
    stockOutForm.addEventListener("submit", handleStockOutSubmit);
}

outReferenceInput.addEventListener("input", function () {
    outReferenceInput.removeAttribute("aria-invalid");
});

const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebarToggle");
const sidebarScrim = document.querySelector("#sidebarScrim");
const notificationButton = document.querySelector("#notificationButton");
const notificationPopover = document.querySelector("#notificationPopover");

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
