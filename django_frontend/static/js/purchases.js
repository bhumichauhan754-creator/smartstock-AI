"use strict";

const purchaseStorageKey = "smartstock.samplePurchases";
const productStorageKey = "smartstock.sampleProducts";
const supplierStorageKey = "smartstock.sampleSuppliers";
const defaultSupplierNames = [
    "Acme Supply Co.",
    "TechSource Distributors",
    "Office Hub Wholesale",
    "Metro Packaging"
];
const seededPurchases = [
    {
        id: "PO-2026-041", supplier: "TechSource Distributors", orderDate: "2026-11-18", expectedDate: "2026-11-28",
        receivedDate: "", status: "Ordered", notes: "Please confirm dispatch before shipping.",
        items: [
            { productId: "1", name: "Wireless Headphones", sku: "ELEC-001", quantity: 12, unitCost: 42, subtotal: 504 },
            { productId: "5", name: "Mechanical Keyboard", sku: "ELEC-032", quantity: 8, unitCost: 56, subtotal: 448 },
            { productId: "7", name: "Bluetooth Speaker", sku: "ELEC-041", quantity: 10, unitCost: 29, subtotal: 290 }
        ],
        total: 1242
    },
    {
        id: "PO-2026-040", supplier: "Acme Supply Co.", orderDate: "2026-11-14", expectedDate: "2026-11-20",
        receivedDate: "2026-11-20", status: "Received", notes: "",
        items: [
            { productId: "2", name: "USB-C Hub", sku: "ACC-014", quantity: 18, unitCost: 18.5, subtotal: 333 },
            { productId: "4", name: "Wireless Mouse", sku: "ACC-023", quantity: 25, unitCost: 12, subtotal: 300 }
        ],
        total: 633
    },
    {
        id: "PO-2026-039", supplier: "Office Hub Wholesale", orderDate: "2026-11-12", expectedDate: "2026-11-30",
        receivedDate: "", status: "Draft", notes: "Waiting for budget approval.",
        items: [
            { productId: "6", name: "Desk Organizer Set", sku: "OFF-019", quantity: 14, unitCost: 8.5, subtotal: 119 },
            { productId: "8", name: "Notebook Multipack", sku: "OFF-027", quantity: 20, unitCost: 5, subtotal: 100 }
        ],
        total: 219
    },
    {
        id: "PO-2026-038", supplier: "Metro Packaging", orderDate: "2026-11-07", expectedDate: "2026-11-15",
        receivedDate: "", status: "Cancelled", notes: "Replaced with a consolidated order.",
        items: [
            { productId: "8", name: "Notebook Multipack", sku: "OFF-027", quantity: 30, unitCost: 5, subtotal: 150 },
            { productId: "6", name: "Desk Organizer Set", sku: "OFF-019", quantity: 10, unitCost: 8.5, subtotal: 85 }
        ],
        total: 235
    },
    {
        id: "PO-2026-037", supplier: "TechSource Distributors", orderDate: "2026-11-03", expectedDate: "2026-11-10",
        receivedDate: "2026-11-10", status: "Received", notes: "",
        items: [
            { productId: "3", name: "Ergonomic Office Chair", sku: "FURN-008", quantity: 4, unitCost: 118, subtotal: 472 }
        ],
        total: 472
    }
];
const seededProducts = [
    { id: "1", name: "Wireless Headphones", sku: "ELEC-001", purchasePrice: 42 },
    { id: "2", name: "USB-C Hub", sku: "ACC-014", purchasePrice: 18.5 },
    { id: "3", name: "Ergonomic Office Chair", sku: "FURN-008", purchasePrice: 118 },
    { id: "4", name: "Wireless Mouse", sku: "ACC-023", purchasePrice: 12 },
    { id: "5", name: "Mechanical Keyboard", sku: "ELEC-032", purchasePrice: 56 },
    { id: "6", name: "Desk Organizer Set", sku: "OFF-019", purchasePrice: 8.5 },
    { id: "7", name: "Bluetooth Speaker", sku: "ELEC-041", purchasePrice: 29 },
    { id: "8", name: "Notebook Multipack", sku: "OFF-027", purchasePrice: 5 }
];
const purchaseRows = document.querySelector("#purchaseRows");
const purchaseSearch = document.querySelector("#purchaseSearch");
const purchaseStatusFilter = document.querySelector("#purchaseStatusFilter");
const purchaseEmpty = document.querySelector("#purchaseEmpty");
const purchaseResults = document.querySelector("#purchaseResults");
const purchaseStorageWarning = document.querySelector("#purchaseStorageWarning");
const purchaseFeedback = document.querySelector("#purchaseFeedback");
const newPurchaseButton = document.querySelector("#newPurchaseButton");
const purchaseDialog = document.querySelector("#purchaseDialog");
const purchaseForm = document.querySelector("#purchaseForm");
const demoMode = purchaseForm.dataset.demo !== "false";
const purchaseReferenceInput = document.querySelector("#purchaseReference");
const purchaseSupplierInput = document.querySelector("#purchaseSupplier");
const purchaseOrderDateInput = document.querySelector("#purchaseOrderDate");
const purchaseExpectedDateInput = document.querySelector("#purchaseExpectedDate");
const purchaseNotesInput = document.querySelector("#purchaseNotes");
const purchaseLines = document.querySelector("#purchaseLines");
const purchaseDialogTotal = document.querySelector("#purchaseDialogTotal");
const purchaseDialogMessage = document.querySelector("#purchaseDialogMessage");
const purchaseSubmitButton = purchaseForm.querySelector("button[type='submit']");
const detailDialog = document.querySelector("#purchaseDetailDialog");
const detailPurchaseTitle = document.querySelector("#detailPurchaseTitle");
const detailPurchaseSubtitle = document.querySelector("#detailPurchaseSubtitle");
const purchaseDetailBody = document.querySelector("#purchaseDetailBody");
const purchaseStatusAction = document.querySelector("#purchaseStatusAction");
const purchaseCancelAction = document.querySelector("#purchaseCancelAction");
const purchaseStats = {
    value: document.querySelector("#purchaseValue"),
    pending: document.querySelector("#pendingPurchases"),
    received: document.querySelector("#receivedPurchases"),
    suppliers: document.querySelector("#purchaseSuppliers")
};
let purchases = [];
let products = [];
let storageReady = true;
let lineNumber = 0;
let currentDetailPurchaseId = "";

function getLocalDateValue(date) {
    const localDate = date || new Date();
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(value);
}

function formatDate(value) {
    if (!value) {
        return "—";
    }
    return new Date(value + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function createPurchaseReference() {
    return "PO-" + new Date().getFullYear() + "-" + Date.now().toString(36).slice(-5).toUpperCase();
}

function readProducts() {
    const rawProducts = window.localStorage.getItem(productStorageKey);
    if (!rawProducts) {
        return [];
    }

    const savedProducts = JSON.parse(rawProducts);
    if (!Array.isArray(savedProducts)) {
        throw new TypeError("Saved sample products must be stored as a list.");
    }
    savedProducts.forEach(function (product) {
        if (!product || typeof product.id !== "string" || typeof product.name !== "string" ||
            typeof product.sku !== "string" || !Number.isFinite(product.purchasePrice)) {
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
    purchaseSupplierInput.replaceChildren(placeholder);
    suppliers.forEach(function (supplier) {
        const option = document.createElement("option");
        option.value = typeof supplier === "string" ? supplier : String(supplier.id);
        option.textContent = typeof supplier === "string" ? supplier : supplier.name;
        purchaseSupplierInput.appendChild(option);
    });
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

function readPurchases() {
    const rawPurchases = window.localStorage.getItem(purchaseStorageKey);
    if (!rawPurchases) {
        return seededPurchases.map(function (purchase) {
            return Object.assign({}, purchase, {
                items: purchase.items.map(function (item) {
                    return Object.assign({}, item);
                })
            });
        });
    }

    const savedPurchases = JSON.parse(rawPurchases);
    if (!Array.isArray(savedPurchases)) {
        throw new TypeError("Saved sample purchases must be stored as a list.");
    }

    savedPurchases.forEach(function (purchase) {
        const validPurchase = purchase &&
            typeof purchase.id === "string" &&
            typeof purchase.supplier === "string" &&
            typeof purchase.orderDate === "string" &&
            ["Draft", "Ordered", "Received", "Cancelled"].includes(purchase.status) &&
            Array.isArray(purchase.items) &&
            purchase.items.every(function (item) {
                return item &&
                    typeof item.productId === "string" &&
                    typeof item.name === "string" &&
                    Number.isFinite(item.quantity) &&
                    Number.isFinite(item.unitCost) &&
                    Number.isFinite(item.subtotal);
            }) &&
            Number.isFinite(purchase.total);

        if (!validPurchase) {
            throw new TypeError("A saved sample purchase has an invalid shape.");
        }
    });

    return savedPurchases;
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

function createPurchaseRow(purchase) {
    const row = document.createElement("tr");
    row.dataset.purchaseId = purchase.id;

    const orderCell = document.createElement("div");
    orderCell.className = "purchase-order-cell";
    const orderReference = document.createElement("strong");
    const orderSummary = document.createElement("small");
    orderReference.textContent = purchase.id;
    orderSummary.textContent = purchase.expectedDate ? "Due " + formatDate(purchase.expectedDate) : "No delivery date";
    orderCell.append(orderReference, orderSummary);
    row.appendChild(createCell(orderCell));
    row.appendChild(createCell(purchase.supplier));
    row.appendChild(createCell(formatDate(purchase.orderDate)));
    row.appendChild(createCell(String(purchase.items.length)));
    row.appendChild(createCell(formatCurrency(purchase.total), "purchase-amount"));

    const status = document.createElement("span");
    status.className = "purchase-status " + purchase.status.toLowerCase();
    const statusDot = document.createElement("i");
    status.append(statusDot, document.createTextNode(purchase.status));
    row.appendChild(createCell(status));

    const actions = document.createElement("div");
    actions.className = "purchase-row-actions";
    const viewButton = document.createElement("button");
    viewButton.className = "purchase-row-action";
    viewButton.type = "button";
    viewButton.dataset.purchaseAction = "view";
    viewButton.textContent = "View";
    viewButton.setAttribute("aria-label", "View purchase " + purchase.id);
    actions.appendChild(viewButton);

    const nextStatus = getNextStatus(purchase.status);
    if (nextStatus) {
        const statusButton = document.createElement("button");
        statusButton.className = "purchase-row-action primary";
        statusButton.type = "button";
        statusButton.dataset.purchaseAction = "status";
        statusButton.textContent = nextStatus === "Received" ? "Mark received" : "Place order";
        statusButton.setAttribute("aria-label", statusButton.textContent + " " + purchase.id);
        statusButton.disabled = !storageReady;
        actions.appendChild(statusButton);
    }
    row.appendChild(createCell(actions));
    return row;
}

function getNextStatus(status) {
    if (status === "Draft") {
        return "Ordered";
    }
    if (status === "Ordered") {
        return "Received";
    }
    return "";
}

function renderSummary() {
    const currentMonth = getLocalDateValue().slice(0, 7);
    purchaseStats.value.textContent = formatCurrency(purchases.reduce(function (total, purchase) {
        return total + purchase.total;
    }, 0));
    purchaseStats.pending.textContent = String(purchases.filter(function (purchase) {
        return purchase.status === "Draft" || purchase.status === "Ordered";
    }).length);
    purchaseStats.received.textContent = String(purchases.filter(function (purchase) {
        const receivedDate = purchase.receivedDate || purchase.orderDate;
        return purchase.status === "Received" && receivedDate.slice(0, 7) === currentMonth;
    }).length);
    purchaseStats.suppliers.textContent = String(new Set(purchases.map(function (purchase) {
        return purchase.supplier;
    })).size);
}

function renderPurchases() {
    const query = purchaseSearch.value.trim().toLowerCase();
    const statusFilter = purchaseStatusFilter.value;
    const matchingPurchases = purchases.filter(function (purchase) {
        const matchesText = purchase.id.toLowerCase().includes(query) ||
            purchase.supplier.toLowerCase().includes(query);
        const matchesStatus = !statusFilter || purchase.status === statusFilter;
        return matchesText && matchesStatus;
    });

    purchaseRows.replaceChildren();
    matchingPurchases.forEach(function (purchase) {
        purchaseRows.appendChild(createPurchaseRow(purchase));
    });
    purchaseEmpty.hidden = matchingPurchases.length > 0;
    purchaseResults.textContent = matchingPurchases.length === purchases.length
        ? "Showing " + purchases.length + " purchase orders"
        : "Showing " + matchingPurchases.length + " of " + purchases.length + " purchase orders";
    renderSummary();
}

function showFeedback(message, isError) {
    purchaseFeedback.textContent = message;
    purchaseFeedback.classList.add("is-visible");
    purchaseFeedback.classList.toggle("is-error", Boolean(isError));
}

function showStorageWarning(message, error) {
    if (error) {
        console.error(message, error);
    }
    purchaseStorageWarning.textContent = message;
    purchaseStorageWarning.hidden = false;
}

function createPurchaseLine() {
    lineNumber += 1;
    const row = document.createElement("tr");
    row.dataset.lineNumber = String(lineNumber);

    const productCell = document.createElement("td");
    const productSelect = document.createElement("select");
    productSelect.className = "purchase-product-select";
    productSelect.name = "product_id";
    productSelect.required = true;
    productSelect.setAttribute("aria-label", "Product for purchase item " + lineNumber);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a product";
    productSelect.appendChild(placeholder);
    products.forEach(function (product) {
        const option = document.createElement("option");
        option.value = product.id;
        option.textContent = product.name + " (" + product.sku + ")";
        productSelect.appendChild(option);
    });
    productCell.appendChild(productSelect);

    const quantityCell = document.createElement("td");
    const quantityInput = document.createElement("input");
    quantityInput.className = "purchase-line-input";
    quantityInput.type = "number";
    quantityInput.name = "quantity";
    quantityInput.min = "0.001";
    quantityInput.step = "any";
    quantityInput.placeholder = "0";
    quantityInput.required = true;
    quantityInput.setAttribute("aria-label", "Quantity for purchase item " + lineNumber);
    quantityCell.appendChild(quantityInput);

    const costCell = document.createElement("td");
    const costInput = document.createElement("input");
    costInput.className = "purchase-line-input";
    costInput.type = "number";
    costInput.name = "unit_cost";
    costInput.min = "0";
    costInput.step = "0.01";
    costInput.placeholder = "0.00";
    costInput.required = true;
    costInput.setAttribute("aria-label", "Unit cost for purchase item " + lineNumber);
    costCell.appendChild(costInput);

    const totalCell = document.createElement("td");
    const total = document.createElement("span");
    total.className = "purchase-line-total";
    total.textContent = formatCurrency(0);
    totalCell.appendChild(total);

    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.className = "purchase-remove-line";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", "Remove purchase item " + lineNumber);
    actionCell.appendChild(removeButton);
    row.append(productCell, quantityCell, costCell, totalCell, actionCell);
    return row;
}

function updateRemoveLineButtons() {
    const rows = Array.from(purchaseLines.querySelectorAll("tr"));
    rows.forEach(function (row) {
        row.querySelector(".purchase-remove-line").disabled = rows.length === 1;
    });
}

function getPurchaseLineValues(row) {
    const productId = row.querySelector(".purchase-product-select").value;
    const quantity = Number(row.querySelector("[name='quantity']").value);
    const unitCost = Number(row.querySelector("[name='unit_cost']").value);
    const product = products.find(function (item) {
        return item.id === productId;
    });
    return { product: product, quantity: quantity, unitCost: unitCost };
}

function updatePurchaseLineTotal(row) {
    const values = getPurchaseLineValues(row);
    const subtotal = values.quantity > 0 && values.unitCost >= 0
        ? values.quantity * values.unitCost
        : 0;
    row.querySelector(".purchase-line-total").textContent = formatCurrency(subtotal);
    const total = Array.from(purchaseLines.querySelectorAll("tr")).reduce(function (sum, line) {
        const lineValues = getPurchaseLineValues(line);
        return lineValues.quantity > 0 && lineValues.unitCost >= 0
            ? sum + lineValues.quantity * lineValues.unitCost
            : sum;
    }, 0);
    purchaseDialogTotal.textContent = formatCurrency(total);
}

function resetPurchaseForm() {
    purchaseForm.reset();
    purchaseReferenceInput.value = createPurchaseReference();
    purchaseOrderDateInput.value = getLocalDateValue();
    purchaseExpectedDateInput.value = "";
    purchaseDialogMessage.textContent = "";
    purchaseDialogMessage.classList.remove("is-visible");
    purchaseLines.replaceChildren();
    lineNumber = 0;
    purchaseLines.appendChild(createPurchaseLine());
    updateRemoveLineButtons();
    purchaseDialogTotal.textContent = formatCurrency(0);
}

function openPurchaseDialog() {
    resetPurchaseForm();
    purchaseDialog.showModal();
    purchaseSupplierInput.focus();
}

function validatePurchaseLines() {
    let firstInvalidControl = null;
    const seenProductIds = new Set();
    let duplicateProduct = false;

    Array.from(purchaseLines.querySelectorAll("tr")).forEach(function (row) {
        const select = row.querySelector(".purchase-product-select");
        const quantity = row.querySelector("[name='quantity']");
        const cost = row.querySelector("[name='unit_cost']");
        if (!select.value || !select.checkValidity()) {
            firstInvalidControl = firstInvalidControl || select;
        }
        if (!quantity.value || !quantity.checkValidity()) {
            firstInvalidControl = firstInvalidControl || quantity;
        }
        if (cost.value === "" || !cost.checkValidity()) {
            firstInvalidControl = firstInvalidControl || cost;
        }
        if (select.value && seenProductIds.has(select.value)) {
            duplicateProduct = true;
            firstInvalidControl = firstInvalidControl || select;
        }
        if (select.value) {
            seenProductIds.add(select.value);
        }
    });

    if (duplicateProduct) {
        purchaseDialogMessage.textContent = "Add each product only once and combine its quantity on the same line.";
        purchaseDialogMessage.classList.add("is-visible");
    }
    if (firstInvalidControl) {
        firstInvalidControl.focus();
        return false;
    }
    return !duplicateProduct;
}

function buildPurchase() {
    const items = Array.from(purchaseLines.querySelectorAll("tr")).map(function (row) {
        const values = getPurchaseLineValues(row);
        return {
            productId: values.product.id,
            name: values.product.name,
            sku: values.product.sku,
            quantity: values.quantity,
            unitCost: values.unitCost,
            subtotal: values.quantity * values.unitCost
        };
    });
    return {
        id: purchaseReferenceInput.value.trim(),
        supplier: purchaseSupplierInput.value,
        orderDate: purchaseOrderDateInput.value,
        expectedDate: purchaseExpectedDateInput.value,
        receivedDate: "",
        status: "Ordered",
        notes: purchaseNotesInput.value.trim(),
        items: items,
        total: items.reduce(function (sum, item) {
            return sum + item.subtotal;
        }, 0)
    };
}

function savePurchases(updatedPurchases) {
    window.localStorage.setItem(purchaseStorageKey, JSON.stringify(updatedPurchases));
}

function handlePurchaseSubmit(event) {
    event.preventDefault();
    purchaseDialogMessage.textContent = "";
    purchaseDialogMessage.classList.remove("is-visible");

    if (!storageReady) {
        purchaseDialogMessage.textContent = "Sample purchase data is unavailable. Clear the saved SmartStock purchase data and refresh.";
        purchaseDialogMessage.classList.add("is-visible");
        return;
    }

    if (!validatePurchaseLines()) {
        return;
    }
    if (!purchaseForm.checkValidity()) {
        purchaseForm.reportValidity();
        return;
    }

    const reference = purchaseReferenceInput.value.trim();
    if (purchases.some(function (purchase) {
        return purchase.id.toLowerCase() === reference.toLowerCase();
    })) {
        purchaseDialogMessage.textContent = "This purchase order number already exists. Enter a unique reference.";
        purchaseDialogMessage.classList.add("is-visible");
        purchaseReferenceInput.focus();
        return;
    }

    const purchase = buildPurchase();
    const updatedPurchases = purchases.concat(purchase);
    try {
        savePurchases(updatedPurchases);
    } catch (error) {
        console.error("Could not save the sample purchase order.", error);
        purchaseDialogMessage.textContent = "The purchase order could not be saved in browser storage. Check available storage and try again.";
        purchaseDialogMessage.classList.add("is-visible");
        return;
    }

    purchases = updatedPurchases;
    renderPurchases();
    showFeedback("Purchase order " + purchase.id + " was created with Ordered status. Record its delivery on Stock In when it arrives.", false);
    purchaseDialog.close();
}

function updatePurchaseStatus(purchaseId, nextStatus) {
    if (!demoMode) {
        submitPurchaseStatus(purchaseId, nextStatus);
        return true;
    }
    if (!storageReady) {
        showFeedback("Purchase data is unavailable, so the order status could not be updated.", true);
        return false;
    }

    function submitPurchaseStatus(purchaseId, status) {
        const form = document.createElement("form");
        form.method = "post";
        form.action = "/purchases/" + encodeURIComponent(purchaseId) + "/status/";
        const csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = "csrfmiddlewaretoken";
        csrfInput.value = purchaseForm.querySelector("[name='csrfmiddlewaretoken']").value;
        const statusInput = document.createElement("input");
        statusInput.type = "hidden";
        statusInput.name = "status";
        statusInput.value = status;
        form.append(csrfInput, statusInput);
        document.body.appendChild(form);
        form.submit();
    }
    const purchaseIndex = purchases.findIndex(function (purchase) {
        return purchase.id === purchaseId;
    });
    if (purchaseIndex === -1) {
        showFeedback("That purchase order could not be found. Refresh and try again.", true);
        return false;
    }

    const currentStatus = purchases[purchaseIndex].status;
    const allowedNextStatus = nextStatus === "Cancelled"
        ? currentStatus === "Draft" || currentStatus === "Ordered"
        : getNextStatus(currentStatus) === nextStatus;
    if (!allowedNextStatus) {
        showFeedback("This purchase order cannot move to that status.", true);
        return false;
    }

    const updatedPurchases = purchases.map(function (purchase, index) {
        if (index !== purchaseIndex) {
            return purchase;
        }
        return Object.assign({}, purchase, {
            status: nextStatus,
            receivedDate: nextStatus === "Received" ? getLocalDateValue() : purchase.receivedDate
        });
    });
    try {
        savePurchases(updatedPurchases);
    } catch (error) {
        console.error("Could not update the sample purchase status.", error);
        showFeedback("The purchase status could not be saved in browser storage. Check available storage and try again.", true);
        return false;
    }

    purchases = updatedPurchases;
    renderPurchases();
    showFeedback(nextStatus === "Received"
        ? purchaseId + " marked received. Record delivered quantities on Stock In to update inventory."
        : purchaseId + " is now " + nextStatus.toLowerCase() + ".", false);
    return true;
}

function appendDetailMeta(container, label, value) {
    const item = document.createElement("span");
    const caption = document.createElement("small");
    caption.textContent = label;
    item.append(caption, document.createTextNode(value || "—"));
    container.appendChild(item);
}

function openPurchaseDetails(purchase) {
    currentDetailPurchaseId = purchase.id;
    detailPurchaseTitle.textContent = purchase.id;
    detailPurchaseSubtitle.textContent = purchase.supplier;
    purchaseDetailBody.replaceChildren();

    const meta = document.createElement("div");
    meta.className = "purchase-detail-meta";
    appendDetailMeta(meta, "Supplier", purchase.supplier);
    appendDetailMeta(meta, "Status", purchase.status);
    appendDetailMeta(meta, "Order date", formatDate(purchase.orderDate));
    appendDetailMeta(meta, "Expected delivery", formatDate(purchase.expectedDate));
    if (purchase.receivedDate) {
        appendDetailMeta(meta, "Received date", formatDate(purchase.receivedDate));
    }
    purchaseDetailBody.appendChild(meta);

    const table = document.createElement("table");
    table.className = "purchase-detail-items";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["PRODUCT", "QTY", "UNIT COST", "TOTAL"].forEach(function (label) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = label;
        headerRow.appendChild(cell);
    });
    head.appendChild(headerRow);
    table.appendChild(head);
    const body = document.createElement("tbody");
    purchase.items.forEach(function (item) {
        const row = document.createElement("tr");
        [item.name + " · " + item.sku, String(item.quantity), formatCurrency(item.unitCost), formatCurrency(item.subtotal)]
            .forEach(function (value) {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });
        body.appendChild(row);
    });
    table.appendChild(body);
    purchaseDetailBody.appendChild(table);

    const total = document.createElement("div");
    total.className = "purchase-detail-total";
    const totalLabel = document.createElement("span");
    const totalValue = document.createElement("strong");
    totalLabel.textContent = "Order total";
    totalValue.textContent = formatCurrency(purchase.total);
    total.append(totalLabel, totalValue);
    purchaseDetailBody.appendChild(total);

    if (purchase.notes) {
        const notes = document.createElement("p");
        notes.className = "purchase-detail-notes";
        notes.textContent = purchase.notes;
        purchaseDetailBody.appendChild(notes);
    }

    const nextStatus = getNextStatus(purchase.status);
    purchaseStatusAction.hidden = !nextStatus;
    purchaseStatusAction.textContent = nextStatus === "Received" ? "Mark received" : "Place order";
    purchaseCancelAction.hidden = purchase.status !== "Draft" && purchase.status !== "Ordered";
    purchaseStatusAction.disabled = !storageReady;
    purchaseCancelAction.disabled = !storageReady;
    detailDialog.showModal();
}

function handleStatusAction(purchaseId, nextStatus) {
    if (nextStatus === "Received" &&
        !window.confirm("Mark this purchase order as received? Record the physical quantities separately on Stock In.")) {
        return;
    }
    if (updatePurchaseStatus(purchaseId, nextStatus)) {
        detailDialog.close();
    }
}

function setSidebarOpen(isOpen) {
    sidebar.classList.toggle("is-open", isOpen);
    sidebarScrim.classList.toggle("is-open", isOpen);
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

if (!demoMode) {
    products = JSON.parse(document.querySelector("#purchaseProducts").textContent);
    purchases = JSON.parse(document.querySelector("#purchaseData").textContent);
    populateSupplierOptions(JSON.parse(document.querySelector("#purchaseSupplierData").textContent));
} else {
    try {
        products = loadProducts(readProducts());
        purchases = readPurchases();
        populateSupplierOptions(readSupplierNames());
    } catch (error) {
        storageReady = false;
        newPurchaseButton.disabled = true;
        showStorageWarning("Saved purchase, product or supplier data could not be loaded. Clear the SmartStock sample data in browser storage and refresh.", error);
        purchases = seededPurchases.map(function (purchase) {
            return Object.assign({}, purchase, {
                items: purchase.items.map(function (item) {
                    return Object.assign({}, item);
                })
            });
        });
        products = seededProducts.map(function (product) {
            return Object.assign({}, product);
        });
    }
}
renderPurchases();

newPurchaseButton.addEventListener("click", function () {
    if (storageReady) {
        openPurchaseDialog();
    }
});

document.querySelector("#closePurchaseDialog").addEventListener("click", function () {
    purchaseDialog.close();
});
document.querySelector("#cancelPurchaseDialog").addEventListener("click", function () {
    purchaseDialog.close();
});
purchaseDialog.addEventListener("click", function (event) {
    if (event.target === purchaseDialog) {
        purchaseDialog.close();
    }
});
if (demoMode) {
    purchaseForm.addEventListener("submit", handlePurchaseSubmit);
}
document.querySelector("#addPurchaseLine").addEventListener("click", function () {
    purchaseLines.appendChild(createPurchaseLine());
    updateRemoveLineButtons();
});

purchaseLines.addEventListener("click", function (event) {
    const removeButton = event.target.closest(".purchase-remove-line");
    if (!removeButton || removeButton.disabled) {
        return;
    }
    removeButton.closest("tr").remove();
    updateRemoveLineButtons();
    purchaseDialogTotal.textContent = formatCurrency(Array.from(purchaseLines.querySelectorAll("tr")).reduce(function (sum, row) {
        const values = getPurchaseLineValues(row);
        return values.quantity > 0 && values.unitCost >= 0 ? sum + values.quantity * values.unitCost : sum;
    }, 0));
});

purchaseLines.addEventListener("change", function (event) {
    const row = event.target.closest("tr");
    if (!row) {
        return;
    }
    if (event.target.matches(".purchase-product-select")) {
        const product = products.find(function (item) {
            return item.id === event.target.value;
        });
        row.querySelector("[name='unit_cost']").value = product ? String(product.purchasePrice) : "";
    }
    updatePurchaseLineTotal(row);
});

purchaseLines.addEventListener("input", function (event) {
    const row = event.target.closest("tr");
    if (row && event.target.matches(".purchase-line-input")) {
        updatePurchaseLineTotal(row);
    }
});

purchaseSearch.addEventListener("input", renderPurchases);
purchaseStatusFilter.addEventListener("change", renderPurchases);

purchaseRows.addEventListener("click", function (event) {
    const actionButton = event.target.closest("[data-purchase-action]");
    if (!actionButton) {
        return;
    }
    const row = actionButton.closest("tr");
    const purchase = purchases.find(function (item) {
        return item.id === row.dataset.purchaseId;
    });
    if (!purchase) {
        return;
    }
    if (actionButton.dataset.purchaseAction === "view") {
        openPurchaseDetails(purchase);
        return;
    }
    const nextStatus = getNextStatus(purchase.status);
    if (nextStatus) {
        handleStatusAction(purchase.id, nextStatus);
    }
});

document.querySelector("#closePurchaseDetails").addEventListener("click", function () {
    detailDialog.close();
});
document.querySelector("#closePurchaseDetailsFooter").addEventListener("click", function () {
    detailDialog.close();
});
detailDialog.addEventListener("click", function (event) {
    if (event.target === detailDialog) {
        detailDialog.close();
    }
});
purchaseStatusAction.addEventListener("click", function () {
    const purchase = purchases.find(function (item) {
        return item.id === currentDetailPurchaseId;
    });
    if (purchase) {
        handleStatusAction(purchase.id, getNextStatus(purchase.status));
    }
});
purchaseCancelAction.addEventListener("click", function () {
    const purchase = purchases.find(function (item) {
        return item.id === currentDetailPurchaseId;
    });
    if (purchase && window.confirm("Cancel purchase order " + purchase.id + "?")) {
        if (updatePurchaseStatus(purchase.id, "Cancelled")) {
            detailDialog.close();
        }
    }
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

resetPurchaseForm();
