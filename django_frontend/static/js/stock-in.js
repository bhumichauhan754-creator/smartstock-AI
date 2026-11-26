"use strict";

const sampleProductStorageKey = "smartstock.sampleProducts";
const stockReceiptStorageKey = "smartstock.sampleStockReceipts";
const supplierStorageKey = "smartstock.sampleSuppliers";
const defaultSupplierNames = [
    "Acme Supply Co.",
    "TechSource Distributors",
    "Office Hub Wholesale",
    "Metro Packaging"
];
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
const stockInForm = document.querySelector("#stockInForm");
const demoMode = stockInForm.dataset.demo !== "false";
const stockReferenceInput = document.querySelector("#stockReference");
const receivedDateInput = document.querySelector("#receivedDate");
const supplierInput = document.querySelector("#supplierName");
const supplierInvoiceInput = document.querySelector("#supplierInvoice");
const stockNotesInput = document.querySelector("#stockNotes");
const stockLines = document.querySelector("#stockLines");
const stockInTotal = document.querySelector("#stockInTotal");
const stockInMessage = document.querySelector("#stockInMessage");
const addStockLineButton = document.querySelector("#addStockLine");
const stockSaveButton = stockInForm.querySelector("button[type='submit']");
const recentStockRows = document.querySelector("#recentStockRows");
const recentStockEmpty = document.querySelector("#recentStockEmpty");
const receivedToday = document.querySelector("#receivedToday");
const entriesToday = document.querySelector("#entriesToday");
const latestReference = document.querySelector("#latestReference");
let availableProducts = [];
let stockReceipts = [];
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
    return "IN-" + getLocalDateValue().replace(/-/g, "") + "-" + timestamp.slice(-5);
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(value);
}

function showMessage(message, isError) {
    stockInMessage.textContent = message;
    stockInMessage.classList.add("is-visible");
    stockInMessage.classList.toggle("is-error", Boolean(isError));
}

function clearMessage() {
    stockInMessage.textContent = "";
    stockInMessage.classList.remove("is-visible", "is-error");
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

function readSupplierNames() {
    const rawSuppliers = window.localStorage.getItem(supplierStorageKey);
    if (!rawSuppliers) {
        return defaultSupplierNames.slice();
    }

    const savedSuppliers = JSON.parse(rawSuppliers);
    if (!Array.isArray(savedSuppliers) || savedSuppliers.some(function (supplier) {
        return !supplier ||
            typeof supplier.id !== "string" ||
            typeof supplier.name !== "string" ||
            typeof supplier.isActive !== "boolean";
    })) {
        throw new TypeError("Saved sample suppliers have an invalid shape.");
    }

    return savedSuppliers.filter(function (supplier) {
        return supplier.isActive;
    }).map(function (supplier) {
        return supplier.name;
    });
}

function populateSupplierOptions(suppliers) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a supplier";
    supplierInput.replaceChildren(placeholder);
    suppliers.forEach(function (supplier) {
        const option = document.createElement("option");
        option.value = typeof supplier === "string" ? supplier : String(supplier.id);
        option.textContent = typeof supplier === "string" ? supplier : supplier.name;
        supplierInput.appendChild(option);
    });
}

function readStockReceipts() {
    const rawReceipts = window.localStorage.getItem(stockReceiptStorageKey);
    if (!rawReceipts) {
        return [];
    }

    const savedReceipts = JSON.parse(rawReceipts);
    if (!Array.isArray(savedReceipts)) {
        throw new TypeError("Saved sample stock receipts must be stored as a list.");
    }

    savedReceipts.forEach(function (receipt) {
        const validReceipt = receipt &&
            typeof receipt.reference === "string" &&
            typeof receipt.receivedDate === "string" &&
            typeof receipt.createdAt === "string" &&
            typeof receipt.supplier === "string" &&
            Array.isArray(receipt.items) &&
            receipt.items.every(function (item) {
                return item &&
                    typeof item.productId === "string" &&
                    typeof item.name === "string" &&
                    Number.isFinite(item.quantity) &&
                    Number.isFinite(item.unitCost) &&
                    Number.isFinite(item.subtotal);
            }) &&
            Number.isFinite(receipt.total);

        if (!validReceipt) {
            throw new TypeError("A saved sample stock receipt has an invalid shape.");
        }
    });

    return savedReceipts;
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
    productSelect.setAttribute("aria-label", "Product for stock line " + lineNumber);
    productSelect.required = true;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a product";
    productSelect.appendChild(placeholder);

    availableProducts.forEach(function (product) {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = product.name + " (" + product.sku + ") · " +
            product.quantity + " " + product.unit.toLowerCase() + " on hand";
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
    quantityInput.setAttribute("aria-label", "Quantity for stock line " + lineNumber);
    quantityInput.required = true;
    quantityCell.appendChild(quantityInput);

    const costCell = document.createElement("td");
    const costInput = document.createElement("input");
    costInput.className = "stock-line-input";
    costInput.name = "unit_cost";
    costInput.type = "number";
    costInput.min = "0";
    costInput.step = "0.01";
    costInput.placeholder = "0.00";
    costInput.setAttribute("aria-label", "Unit cost for stock line " + lineNumber);
    costInput.required = true;
    costCell.appendChild(costInput);

    const totalCell = document.createElement("td");
    const total = document.createElement("span");
    total.className = "stock-line-total";
    total.textContent = formatCurrency(0);
    totalCell.appendChild(total);

    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.className = "remove-stock-line";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", "Remove product line " + lineNumber);
    removeButton.textContent = "×";
    actionCell.appendChild(removeButton);

    row.append(productCell, quantityCell, costCell, totalCell, actionCell);
    return row;
}

function updateRemoveButtons() {
    const rows = Array.from(stockLines.querySelectorAll("tr"));
    rows.forEach(function (row) {
        row.querySelector(".remove-stock-line").disabled = rows.length === 1;
    });
}

function addLine() {
    stockLines.appendChild(createLineRow());
    updateRemoveButtons();
}

function getLineValues(row) {
    const productId = row.querySelector(".stock-product-select").value;
    const quantity = Number(row.querySelector("[name='quantity']").value);
    const unitCost = Number(row.querySelector("[name='unit_cost']").value);
    const product = availableProducts.find(function (item) {
        return item.id === productId;
    });

    return { product: product, quantity: quantity, unitCost: unitCost };
}

function updateLineTotal(row) {
    const values = getLineValues(row);
    const lineTotal = Number.isFinite(values.quantity) && values.quantity > 0 &&
        Number.isFinite(values.unitCost) && values.unitCost >= 0
        ? values.quantity * values.unitCost
        : 0;
    row.querySelector(".stock-line-total").textContent = formatCurrency(lineTotal);

    const total = Array.from(stockLines.querySelectorAll("tr")).reduce(function (sum, line) {
        const lineValues = getLineValues(line);
        if (!Number.isFinite(lineValues.quantity) || lineValues.quantity <= 0 ||
            !Number.isFinite(lineValues.unitCost) || lineValues.unitCost < 0) {
            return sum;
        }
        return sum + lineValues.quantity * lineValues.unitCost;
    }, 0);
    stockInTotal.textContent = formatCurrency(total);
}

function renderRecentReceipts() {
    const sortedReceipts = stockReceipts.slice().sort(function (first, second) {
        return second.createdAt.localeCompare(first.createdAt);
    });
    recentStockRows.replaceChildren();

    sortedReceipts.slice(0, 5).forEach(function (receipt) {
        const row = document.createElement("tr");
        [
            receipt.reference,
            receipt.supplier,
            new Date(receipt.receivedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            String(receipt.items.length),
            formatCurrency(receipt.total)
        ].forEach(function (value) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });
        recentStockRows.appendChild(row);
    });
    recentStockEmpty.hidden = sortedReceipts.length > 0;

    const today = getLocalDateValue();
    const todaysReceipts = stockReceipts.filter(function (receipt) {
        return receipt.receivedDate === today;
    });
    receivedToday.textContent = String(todaysReceipts.reduce(function (total, receipt) {
        return total + receipt.items.reduce(function (itemTotal, item) {
            return itemTotal + item.quantity;
        }, 0);
    }, 0));
    entriesToday.textContent = String(todaysReceipts.length);
    latestReference.textContent = sortedReceipts.length ? sortedReceipts[0].reference : "No entries yet";
}

function validateReceiptLines() {
    let firstInvalidControl = null;
    const rows = Array.from(stockLines.querySelectorAll("tr"));
    const seenProductIds = new Set();
    let duplicateProduct = false;

    rows.forEach(function (row) {
        const productSelect = row.querySelector(".stock-product-select");
        const quantityInput = row.querySelector("[name='quantity']");
        const costInput = row.querySelector("[name='unit_cost']");
        const productId = productSelect.value;

        if (!productId || !productSelect.checkValidity()) {
            productSelect.setAttribute("aria-invalid", "true");
            firstInvalidControl = firstInvalidControl || productSelect;
        } else {
            productSelect.removeAttribute("aria-invalid");
        }

        if (!quantityInput.value || !quantityInput.checkValidity()) {
            quantityInput.setAttribute("aria-invalid", "true");
            firstInvalidControl = firstInvalidControl || quantityInput;
        } else {
            quantityInput.removeAttribute("aria-invalid");
        }

        if (costInput.value === "" || !costInput.checkValidity()) {
            costInput.setAttribute("aria-invalid", "true");
            firstInvalidControl = firstInvalidControl || costInput;
        } else {
            costInput.removeAttribute("aria-invalid");
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

    if (duplicateProduct) {
        showMessage("Choose each product only once. Combine the received quantity on its product line.", true);
    }

    if (firstInvalidControl) {
        firstInvalidControl.focus();
        return false;
    }

    return !duplicateProduct;
}

function buildReceipt() {
    const items = Array.from(stockLines.querySelectorAll("tr")).map(function (row) {
        const values = getLineValues(row);
        return {
            productId: values.product.id,
            name: values.product.name,
            sku: values.product.sku,
            quantity: values.quantity,
            unit: values.product.unit,
            unitCost: values.unitCost,
            subtotal: values.quantity * values.unitCost
        };
    });

    return {
        id: "receipt-" + Date.now().toString(36),
        reference: stockReferenceInput.value.trim(),
        receivedDate: receivedDateInput.value,
        supplier: supplierInput.value,
        supplierInvoice: supplierInvoiceInput.value.trim(),
        notes: stockNotesInput.value.trim(),
        items: items,
        total: items.reduce(function (total, item) {
            return total + item.subtotal;
        }, 0),
        createdAt: new Date().toISOString()
    };
}

function updateProductQuantities(savedProducts, receipt) {
    const updatedProducts = savedProducts.slice();
    receipt.items.forEach(function (item) {
        const savedIndex = updatedProducts.findIndex(function (product) {
            return product.id === item.productId;
        });
        const baseProduct = savedIndex === -1
            ? availableProducts.find(function (product) {
                return product.id === item.productId;
            })
            : updatedProducts[savedIndex];
        const updatedProduct = Object.assign({}, baseProduct, {
            quantity: baseProduct.quantity + item.quantity
        });

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

function persistReceipt(receipt) {
    const previousProducts = window.localStorage.getItem(sampleProductStorageKey);
    const previousReceipts = window.localStorage.getItem(stockReceiptStorageKey);
    const savedProducts = readSavedProducts();
    const savedReceipts = readStockReceipts();
    const updatedProducts = updateProductQuantities(savedProducts, receipt);
    const updatedReceipts = savedReceipts.concat(receipt);
    let productsWritten = false;

    try {
        window.localStorage.setItem(sampleProductStorageKey, JSON.stringify(updatedProducts));
        productsWritten = true;
        window.localStorage.setItem(stockReceiptStorageKey, JSON.stringify(updatedReceipts));
    } catch (error) {
        if (productsWritten) {
            try {
                restoreStorageValue(sampleProductStorageKey, previousProducts);
            } catch (rollbackError) {
                console.error("Could not roll back product quantities after the stock receipt failed to save.", rollbackError);
            }
        }
        throw error;
    }
}

function handleStockInSubmit(event) {
    if (stockInForm.dataset.demo !== "true") {
        if (!stockInForm.checkValidity()) {
            event.preventDefault();
            stockInForm.reportValidity();
        }
        return;
    }

    event.preventDefault();
    clearMessage();

    if (!storageReady) {
        showMessage("Sample inventory data is unavailable. Clear the SmartStock sample data in browser storage and refresh.", true);
        return;
    }

    if (!stockInForm.checkValidity()) {
        stockInForm.reportValidity();
        return;
    }

    if (!validateReceiptLines()) {
        return;
    }

    const reference = stockReferenceInput.value.trim().toLowerCase();
    if (stockReceipts.some(function (receipt) {
        return receipt.reference.toLowerCase() === reference;
    })) {
        stockReferenceInput.setAttribute("aria-invalid", "true");
        stockReferenceInput.focus();
        showMessage("This reference number has already been used. Enter a unique reference.", true);
        return;
    }
    stockReferenceInput.removeAttribute("aria-invalid");

    const receipt = buildReceipt();
    try {
        persistReceipt(receipt);
    } catch (error) {
        console.error("Could not save the sample stock receipt.", error);
        showMessage("The stock receipt could not be saved in browser storage. Check available storage and try again.", true);
        return;
    }

    stockReceipts = stockReceipts.concat(receipt);
    availableProducts = loadProducts(readSavedProducts());
    renderRecentReceipts();
    showMessage("Stock receipt " + receipt.reference + " saved. Product quantities have been updated.", false);
    stockInForm.reset();
    stockReferenceInput.value = createReference();
    receivedDateInput.value = getLocalDateValue();
    stockLines.replaceChildren();
    lineNumber = 0;
    addLine();
    stockInTotal.textContent = formatCurrency(0);
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
    addStockLineButton.disabled = true;
    stockSaveButton.disabled = true;
}

if (!demoMode) {
    availableProducts = JSON.parse(document.querySelector("#stockInProducts").textContent);
    stockReceipts = JSON.parse(document.querySelector("#stockReceipts").textContent);
    populateSupplierOptions(JSON.parse(document.querySelector("#stockInSuppliers").textContent));
    renderRecentReceipts();
    const summary = JSON.parse(document.querySelector("#stockInSummary").textContent);
    receivedToday.textContent = String(summary.quantityToday);
    entriesToday.textContent = String(summary.entriesToday);
    latestReference.textContent = summary.latestReference || "No entries yet";
} else {
    try {
        const savedProducts = readSavedProducts();
        const supplierNames = readSupplierNames();
        stockReceipts = readStockReceipts();
        availableProducts = loadProducts(savedProducts);
        populateSupplierOptions(supplierNames);
        renderRecentReceipts();
    } catch (error) {
        disableStockEntry("Saved sample inventory or supplier data could not be loaded. Clear the SmartStock sample data in browser storage and refresh.", error);
        availableProducts = seededProducts.map(function (product) {
            return Object.assign({}, product);
        });
    }
}

stockReferenceInput.value = createReference();
receivedDateInput.value = getLocalDateValue();
addLine();

addStockLineButton.addEventListener("click", function () {
    if (storageReady) {
        addLine();
    }
});

stockLines.addEventListener("click", function (event) {
    const removeButton = event.target.closest(".remove-stock-line");
    if (!removeButton || removeButton.disabled) {
        return;
    }
    removeButton.closest("tr").remove();
    updateRemoveButtons();
    stockInTotal.textContent = formatCurrency(Array.from(stockLines.querySelectorAll("tr")).reduce(function (total, row) {
        const values = getLineValues(row);
        return total + (values.quantity > 0 && values.unitCost >= 0 ? values.quantity * values.unitCost : 0);
    }, 0));
});

stockLines.addEventListener("change", function (event) {
    const row = event.target.closest("tr");
    if (!row) {
        return;
    }

    if (event.target.matches(".stock-product-select")) {
        const product = availableProducts.find(function (item) {
            return item.id === event.target.value;
        });
        const costInput = row.querySelector("[name='unit_cost']");
        costInput.value = product ? String(product.purchasePrice) : "";
        event.target.removeAttribute("aria-invalid");
    } else if (event.target.matches(".stock-line-input")) {
        event.target.removeAttribute("aria-invalid");
    }
    updateLineTotal(row);
});

stockLines.addEventListener("input", function (event) {
    const row = event.target.closest("tr");
    if (row && event.target.matches(".stock-line-input")) {
        event.target.removeAttribute("aria-invalid");
        updateLineTotal(row);
    }
});

if (demoMode) {
    stockInForm.addEventListener("submit", handleStockInSubmit);
}

stockReferenceInput.addEventListener("input", function () {
    stockReferenceInput.removeAttribute("aria-invalid");
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
