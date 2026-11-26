"use strict";

const salesStorageKey = "smartstock.sampleSales";
const productStorageKey = "smartstock.sampleProducts";
const customerStorageKey = "smartstock.sampleCustomers";
const defaultCustomerNames = [
    "Northside Design Studio",
    "Willow Creek Retail",
    "Brightline Offices",
    "Walk-in customer"
];
const seededSales = [
    {
        id: "INV-2026-106", customer: "Northside Design Studio", saleDate: "2026-11-24",
        paymentStatus: "Paid", notes: "",
        items: [
            { productId: "1", name: "Wireless Headphones", sku: "ELEC-001", quantity: 3, unitPrice: 79, subtotal: 237 },
            { productId: "4", name: "Wireless Mouse", sku: "ACC-023", quantity: 5, unitPrice: 24.99, subtotal: 124.95 }
        ],
        total: 361.95
    },
    {
        id: "INV-2026-105", customer: "Willow Creek Retail", saleDate: "2026-11-20",
        paymentStatus: "Paid", notes: "Bulk office order.",
        items: [
            { productId: "3", name: "Ergonomic Office Chair", sku: "FURN-008", quantity: 2, unitPrice: 219, subtotal: 438 }
        ],
        total: 438
    },
    {
        id: "INV-2026-104", customer: "Brightline Offices", saleDate: "2026-11-18",
        paymentStatus: "Pending", notes: "Payment due within 14 days.",
        items: [
            { productId: "1", name: "Wireless Headphones", sku: "ELEC-001", quantity: 1, unitPrice: 79, subtotal: 79 },
            { productId: "6", name: "Desk Organizer Set", sku: "OFF-019", quantity: 5, unitPrice: 17.99, subtotal: 89.95 }
        ],
        total: 168.95
    },
    {
        id: "INV-2026-103", customer: "Walk-in customer", saleDate: "2026-11-15",
        paymentStatus: "Cancelled", notes: "Customer changed their order.",
        items: [
            { productId: "5", name: "Mechanical Keyboard", sku: "ELEC-032", quantity: 1, unitPrice: 99, subtotal: 99 }
        ],
        total: 99
    },
    {
        id: "INV-2026-102", customer: "Northside Design Studio", saleDate: "2026-11-08",
        paymentStatus: "Pending", notes: "",
        items: [
            { productId: "8", name: "Notebook Multipack", sku: "OFF-027", quantity: 10, unitPrice: 11.5, subtotal: 115 }
        ],
        total: 115
    }
];
const seededProducts = [
    { id: "1", name: "Wireless Headphones", sku: "ELEC-001", sellingPrice: 79 },
    { id: "2", name: "USB-C Hub", sku: "ACC-014", sellingPrice: 34.99 },
    { id: "3", name: "Ergonomic Office Chair", sku: "FURN-008", sellingPrice: 219 },
    { id: "4", name: "Wireless Mouse", sku: "ACC-023", sellingPrice: 24.99 },
    { id: "5", name: "Mechanical Keyboard", sku: "ELEC-032", sellingPrice: 99 },
    { id: "6", name: "Desk Organizer Set", sku: "OFF-019", sellingPrice: 17.99 },
    { id: "7", name: "Bluetooth Speaker", sku: "ELEC-041", sellingPrice: 54 },
    { id: "8", name: "Notebook Multipack", sku: "OFF-027", sellingPrice: 11.5 }
];
const salesRows = document.querySelector("#salesRows");
const salesSearch = document.querySelector("#salesSearch");
const salesStatusFilter = document.querySelector("#salesStatusFilter");
const salesEmpty = document.querySelector("#salesEmpty");
const salesResults = document.querySelector("#salesResults");
const salesStorageWarning = document.querySelector("#salesStorageWarning");
const salesFeedback = document.querySelector("#salesFeedback");
const newSaleButton = document.querySelector("#newSaleButton");
const saleDialog = document.querySelector("#saleDialog");
const saleForm = document.querySelector("#saleForm");
const demoMode = saleForm.dataset.demo !== "false";
const saleReferenceInput = document.querySelector("#saleReference");
const saleCustomerInput = document.querySelector("#saleCustomer");
const saleDateInput = document.querySelector("#saleDate");
const salePaymentStatusInput = document.querySelector("#salePaymentStatus");
const saleNotesInput = document.querySelector("#saleNotes");
const saleLines = document.querySelector("#saleLines");
const saleDialogTotal = document.querySelector("#saleDialogTotal");
const saleDialogMessage = document.querySelector("#saleDialogMessage");
const saleSubmitButton = saleForm.querySelector("button[type='submit']");
const detailDialog = document.querySelector("#saleDetailDialog");
const detailSaleTitle = document.querySelector("#detailSaleTitle");
const detailSaleSubtitle = document.querySelector("#detailSaleSubtitle");
const saleDetailBody = document.querySelector("#saleDetailBody");
const saleStatusAction = document.querySelector("#saleStatusAction");
const cancelSaleAction = document.querySelector("#cancelSaleAction");
const salesStats = {
    value: document.querySelector("#salesValue"),
    pending: document.querySelector("#pendingSales"),
    paid: document.querySelector("#paidSales"),
    customers: document.querySelector("#salesCustomers")
};
let sales = [];
let products = [];
let storageReady = true;
let lineNumber = 0;
let currentDetailSaleId = "";

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

function createInvoiceReference() {
    return "INV-" + new Date().getFullYear() + "-" + Date.now().toString(36).slice(-5).toUpperCase();
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
            typeof product.sku !== "string" || !Number.isFinite(product.sellingPrice)) {
            throw new TypeError("A saved sample product has an invalid shape.");
        }
    });
    return savedProducts;
}

function readCustomerNames() {
    const rawCustomers = window.localStorage.getItem(customerStorageKey);
    if (!rawCustomers) {
        return defaultCustomerNames.slice();
    }

    const savedCustomers = JSON.parse(rawCustomers);
    if (!Array.isArray(savedCustomers) || savedCustomers.some(function (customer) {
        return !customer ||
            typeof customer.id !== "string" ||
            typeof customer.name !== "string" ||
            typeof customer.isActive !== "boolean";
    })) {
        throw new TypeError("Saved sample customers have an invalid shape.");
    }

    return savedCustomers.filter(function (customer) {
        return customer.isActive;
    }).map(function (customer) {
        return customer.name;
    });
}

function populateCustomerOptions(customers) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a customer";
    saleCustomerInput.replaceChildren(placeholder);
    customers.forEach(function (customer) {
        const option = document.createElement("option");
        option.value = typeof customer === "string" ? customer : String(customer.id);
        option.textContent = typeof customer === "string" ? customer : customer.name;
        saleCustomerInput.appendChild(option);
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

function readSales() {
    const rawSales = window.localStorage.getItem(salesStorageKey);
    if (!rawSales) {
        return seededSales.map(function (sale) {
            return Object.assign({}, sale, {
                items: sale.items.map(function (item) {
                    return Object.assign({}, item);
                })
            });
        });
    }

    const savedSales = JSON.parse(rawSales);
    if (!Array.isArray(savedSales)) {
        throw new TypeError("Saved sample sales must be stored as a list.");
    }
    savedSales.forEach(function (sale) {
        const validSale = sale &&
            typeof sale.id === "string" &&
            typeof sale.customer === "string" &&
            typeof sale.saleDate === "string" &&
            ["Pending", "Paid", "Cancelled"].includes(sale.paymentStatus) &&
            Array.isArray(sale.items) &&
            sale.items.every(function (item) {
                return item &&
                    typeof item.productId === "string" &&
                    typeof item.name === "string" &&
                    Number.isFinite(item.quantity) &&
                    Number.isFinite(item.unitPrice) &&
                    Number.isFinite(item.subtotal);
            }) &&
            Number.isFinite(sale.total);
        if (!validSale) {
            throw new TypeError("A saved sample sale has an invalid shape.");
        }
    });
    return savedSales;
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

function createSaleRow(sale) {
    const row = document.createElement("tr");
    row.dataset.saleId = sale.id;

    const invoiceCell = document.createElement("div");
    invoiceCell.className = "sale-invoice-cell";
    const invoiceId = document.createElement("strong");
    const invoiceItems = document.createElement("small");
    invoiceId.textContent = sale.id;
    invoiceItems.textContent = sale.items.length + (sale.items.length === 1 ? " product" : " products");
    invoiceCell.append(invoiceId, invoiceItems);
    row.appendChild(createCell(invoiceCell));
    row.appendChild(createCell(sale.customer));
    row.appendChild(createCell(formatDate(sale.saleDate)));
    row.appendChild(createCell(String(sale.items.length)));
    row.appendChild(createCell(formatCurrency(sale.total), "sale-amount"));

    const status = document.createElement("span");
    status.className = "sale-payment-status " + sale.paymentStatus.toLowerCase();
    const dot = document.createElement("i");
    status.append(dot, document.createTextNode(sale.paymentStatus));
    row.appendChild(createCell(status));

    const actions = document.createElement("div");
    actions.className = "sale-row-actions";
    const viewButton = document.createElement("button");
    viewButton.className = "sale-row-action";
    viewButton.type = "button";
    viewButton.dataset.saleAction = "view";
    viewButton.textContent = "View";
    viewButton.setAttribute("aria-label", "View invoice " + sale.id);
    actions.appendChild(viewButton);

    const nextStatus = getNextStatus(sale.paymentStatus);
    if (nextStatus) {
        const statusButton = document.createElement("button");
        statusButton.className = "sale-row-action primary";
        statusButton.type = "button";
        statusButton.dataset.saleAction = "status";
        statusButton.textContent = "Mark paid";
        statusButton.setAttribute("aria-label", "Mark paid " + sale.id);
        statusButton.disabled = !storageReady;
        actions.appendChild(statusButton);
    }
    row.appendChild(createCell(actions));
    return row;
}

function getNextStatus(status) {
    return status === "Pending" ? "Paid" : "";
}

function renderSummary() {
    const currentMonth = getLocalDateValue().slice(0, 7);
    const activeSales = sales.filter(function (sale) {
        return sale.paymentStatus !== "Cancelled";
    });
    salesStats.value.textContent = formatCurrency(activeSales.reduce(function (total, sale) {
        return total + sale.total;
    }, 0));
    salesStats.pending.textContent = formatCurrency(sales.filter(function (sale) {
        return sale.paymentStatus === "Pending";
    }).reduce(function (total, sale) {
        return total + sale.total;
    }, 0));
    salesStats.paid.textContent = formatCurrency(sales.filter(function (sale) {
        return sale.paymentStatus === "Paid" && sale.saleDate.slice(0, 7) === currentMonth;
    }).reduce(function (total, sale) {
        return total + sale.total;
    }, 0));
    salesStats.customers.textContent = String(new Set(sales.map(function (sale) {
        return sale.customer;
    })).size);
}

function renderSales() {
    const query = salesSearch.value.trim().toLowerCase();
    const statusFilter = salesStatusFilter.value;
    const matchingSales = sales.filter(function (sale) {
        const matchesText = sale.id.toLowerCase().includes(query) ||
            sale.customer.toLowerCase().includes(query);
        const matchesStatus = !statusFilter || sale.paymentStatus === statusFilter;
        return matchesText && matchesStatus;
    });
    salesRows.replaceChildren();
    matchingSales.forEach(function (sale) {
        salesRows.appendChild(createSaleRow(sale));
    });
    salesEmpty.hidden = matchingSales.length > 0;
    salesResults.textContent = matchingSales.length === sales.length
        ? "Showing " + sales.length + " sales invoices"
        : "Showing " + matchingSales.length + " of " + sales.length + " sales invoices";
    renderSummary();
}

function showFeedback(message, isError) {
    salesFeedback.textContent = message;
    salesFeedback.classList.add("is-visible");
    salesFeedback.classList.toggle("is-error", Boolean(isError));
}

function showStorageWarning(message, error) {
    if (error) {
        console.error(message, error);
    }
    salesStorageWarning.textContent = message;
    salesStorageWarning.hidden = false;
}

function createSaleLine() {
    lineNumber += 1;
    const row = document.createElement("tr");
    row.dataset.lineNumber = String(lineNumber);

    const productCell = document.createElement("td");
    const productSelect = document.createElement("select");
    productSelect.className = "sale-product-select";
    productSelect.name = "product_id";
    productSelect.required = true;
    productSelect.setAttribute("aria-label", "Product for invoice item " + lineNumber);
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
    quantityInput.className = "sale-line-input";
    quantityInput.type = "number";
    quantityInput.name = "quantity";
    quantityInput.min = "0.001";
    quantityInput.step = "any";
    quantityInput.placeholder = "0";
    quantityInput.required = true;
    quantityInput.setAttribute("aria-label", "Quantity for invoice item " + lineNumber);
    quantityCell.appendChild(quantityInput);

    const priceCell = document.createElement("td");
    const priceInput = document.createElement("input");
    priceInput.className = "sale-line-input";
    priceInput.type = "number";
    priceInput.name = "unit_price";
    priceInput.min = "0";
    priceInput.step = "0.01";
    priceInput.placeholder = "0.00";
    priceInput.required = true;
    priceInput.setAttribute("aria-label", "Unit price for invoice item " + lineNumber);
    priceCell.appendChild(priceInput);

    const totalCell = document.createElement("td");
    const total = document.createElement("span");
    total.className = "sale-line-total";
    total.textContent = formatCurrency(0);
    totalCell.appendChild(total);

    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.className = "sale-remove-line";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", "Remove invoice item " + lineNumber);
    actionCell.appendChild(removeButton);
    row.append(productCell, quantityCell, priceCell, totalCell, actionCell);
    return row;
}

function updateRemoveLineButtons() {
    const rows = Array.from(saleLines.querySelectorAll("tr"));
    rows.forEach(function (row) {
        row.querySelector(".sale-remove-line").disabled = rows.length === 1;
    });
}

function getSaleLineValues(row) {
    const productId = row.querySelector(".sale-product-select").value;
    const quantity = Number(row.querySelector("[name='quantity']").value);
    const unitPrice = Number(row.querySelector("[name='unit_price']").value);
    const product = products.find(function (item) {
        return item.id === productId;
    });
    return { product: product, quantity: quantity, unitPrice: unitPrice };
}

function updateSaleLineTotal(row) {
    const values = getSaleLineValues(row);
    const subtotal = values.quantity > 0 && values.unitPrice >= 0
        ? values.quantity * values.unitPrice
        : 0;
    row.querySelector(".sale-line-total").textContent = formatCurrency(subtotal);
    const total = Array.from(saleLines.querySelectorAll("tr")).reduce(function (sum, line) {
        const lineValues = getSaleLineValues(line);
        return lineValues.quantity > 0 && lineValues.unitPrice >= 0
            ? sum + lineValues.quantity * lineValues.unitPrice
            : sum;
    }, 0);
    saleDialogTotal.textContent = formatCurrency(total);
}

function resetSaleForm() {
    saleForm.reset();
    saleReferenceInput.value = createInvoiceReference();
    saleDateInput.value = getLocalDateValue();
    salePaymentStatusInput.value = "Pending";
    saleDialogMessage.textContent = "";
    saleDialogMessage.classList.remove("is-visible");
    saleLines.replaceChildren();
    lineNumber = 0;
    saleLines.appendChild(createSaleLine());
    updateRemoveLineButtons();
    saleDialogTotal.textContent = formatCurrency(0);
}

function openSaleDialog() {
    resetSaleForm();
    saleDialog.showModal();
    saleCustomerInput.focus();
}

function validateSaleLines() {
    let firstInvalidControl = null;
    const seenProductIds = new Set();
    let duplicateProduct = false;
    Array.from(saleLines.querySelectorAll("tr")).forEach(function (row) {
        const select = row.querySelector(".sale-product-select");
        const quantity = row.querySelector("[name='quantity']");
        const price = row.querySelector("[name='unit_price']");
        if (!select.value || !select.checkValidity()) {
            firstInvalidControl = firstInvalidControl || select;
        }
        if (!quantity.value || !quantity.checkValidity()) {
            firstInvalidControl = firstInvalidControl || quantity;
        }
        if (price.value === "" || !price.checkValidity()) {
            firstInvalidControl = firstInvalidControl || price;
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
        saleDialogMessage.textContent = "Add each product only once and combine its quantity on the same line.";
        saleDialogMessage.classList.add("is-visible");
    }
    if (firstInvalidControl) {
        firstInvalidControl.focus();
        return false;
    }
    return !duplicateProduct;
}

function buildSale() {
    const items = Array.from(saleLines.querySelectorAll("tr")).map(function (row) {
        const values = getSaleLineValues(row);
        return {
            productId: values.product.id,
            name: values.product.name,
            sku: values.product.sku,
            quantity: values.quantity,
            unitPrice: values.unitPrice,
            subtotal: values.quantity * values.unitPrice
        };
    });
    return {
        id: saleReferenceInput.value.trim(),
        customer: saleCustomerInput.value,
        saleDate: saleDateInput.value,
        paymentStatus: salePaymentStatusInput.value,
        notes: saleNotesInput.value.trim(),
        items: items,
        total: items.reduce(function (sum, item) {
            return sum + item.subtotal;
        }, 0)
    };
}

function saveSales(updatedSales) {
    window.localStorage.setItem(salesStorageKey, JSON.stringify(updatedSales));
}

function handleSaleSubmit(event) {
    event.preventDefault();
    saleDialogMessage.textContent = "";
    saleDialogMessage.classList.remove("is-visible");
    if (!storageReady) {
        saleDialogMessage.textContent = "Sample sales data is unavailable. Clear saved SmartStock sample data and refresh.";
        saleDialogMessage.classList.add("is-visible");
        return;
    }
    if (!validateSaleLines()) {
        return;
    }
    if (!saleForm.checkValidity()) {
        saleForm.reportValidity();
        return;
    }

    const reference = saleReferenceInput.value.trim();
    if (sales.some(function (sale) {
        return sale.id.toLowerCase() === reference.toLowerCase();
    })) {
        saleDialogMessage.textContent = "This invoice number already exists. Enter a unique reference.";
        saleDialogMessage.classList.add("is-visible");
        saleReferenceInput.focus();
        return;
    }

    const sale = buildSale();
    const updatedSales = sales.concat(sale);
    try {
        saveSales(updatedSales);
    } catch (error) {
        console.error("Could not save the sample sales invoice.", error);
        saleDialogMessage.textContent = "The invoice could not be saved in browser storage. Check available storage and try again.";
        saleDialogMessage.classList.add("is-visible");
        return;
    }
    sales = updatedSales;
    renderSales();
    showFeedback("Invoice " + sale.id + " was created. Record dispatched quantities on Stock Out to update inventory.", false);
    saleDialog.close();
}

function updateSaleStatus(saleId, nextStatus) {
    if (!demoMode) {
        submitSaleStatus(saleId, nextStatus);
        return true;
    }
    if (!storageReady) {
        showFeedback("Sales data is unavailable, so the invoice status could not be updated.", true);
        return false;
    }

    function submitSaleStatus(saleId, status) {
        const form = document.createElement("form");
        form.method = "post";
        form.action = "/sales/" + encodeURIComponent(saleId) + "/status/";
        const csrfInput = document.createElement("input");
        csrfInput.type = "hidden";
        csrfInput.name = "csrfmiddlewaretoken";
        csrfInput.value = saleForm.querySelector("[name='csrfmiddlewaretoken']").value;
        const statusInput = document.createElement("input");
        statusInput.type = "hidden";
        statusInput.name = "status";
        statusInput.value = status;
        form.append(csrfInput, statusInput);
        document.body.appendChild(form);
        form.submit();
    }
    const saleIndex = sales.findIndex(function (sale) {
        return sale.id === saleId;
    });
    if (saleIndex === -1) {
        showFeedback("That invoice could not be found. Refresh and try again.", true);
        return false;
    }

    const currentStatus = sales[saleIndex].paymentStatus;
    if (currentStatus !== "Pending" || !["Paid", "Cancelled"].includes(nextStatus)) {
        showFeedback("This invoice cannot move to that payment status.", true);
        return false;
    }
    const updatedSales = sales.map(function (sale, index) {
        return index === saleIndex ? Object.assign({}, sale, { paymentStatus: nextStatus }) : sale;
    });
    try {
        saveSales(updatedSales);
    } catch (error) {
        console.error("Could not update the sample invoice status.", error);
        showFeedback("The invoice status could not be saved in browser storage. Check available storage and try again.", true);
        return false;
    }
    sales = updatedSales;
    renderSales();
    showFeedback(saleId + " marked " + nextStatus.toLowerCase() + ". Record physical inventory movement separately on Stock Out.", false);
    return true;
}

function appendDetailMeta(container, label, value) {
    const item = document.createElement("span");
    const caption = document.createElement("small");
    caption.textContent = label;
    item.append(caption, document.createTextNode(value || "—"));
    container.appendChild(item);
}

function openSaleDetails(sale) {
    currentDetailSaleId = sale.id;
    detailSaleTitle.textContent = sale.id;
    detailSaleSubtitle.textContent = sale.customer;
    saleDetailBody.replaceChildren();

    const meta = document.createElement("div");
    meta.className = "sale-detail-meta";
    appendDetailMeta(meta, "Customer", sale.customer);
    appendDetailMeta(meta, "Payment status", sale.paymentStatus);
    appendDetailMeta(meta, "Sale date", formatDate(sale.saleDate));
    appendDetailMeta(meta, "Invoice", sale.id);
    saleDetailBody.appendChild(meta);

    const table = document.createElement("table");
    table.className = "sale-detail-items";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["PRODUCT", "QTY", "UNIT PRICE", "TOTAL"].forEach(function (label) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = label;
        headerRow.appendChild(cell);
    });
    head.appendChild(headerRow);
    table.appendChild(head);
    const body = document.createElement("tbody");
    sale.items.forEach(function (item) {
        const row = document.createElement("tr");
        [item.name + " · " + item.sku, String(item.quantity), formatCurrency(item.unitPrice), formatCurrency(item.subtotal)]
            .forEach(function (value) {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });
        body.appendChild(row);
    });
    table.appendChild(body);
    saleDetailBody.appendChild(table);

    const total = document.createElement("div");
    total.className = "sale-detail-total";
    const label = document.createElement("span");
    const amount = document.createElement("strong");
    label.textContent = "Invoice total";
    amount.textContent = formatCurrency(sale.total);
    total.append(label, amount);
    saleDetailBody.appendChild(total);
    if (sale.notes) {
        const notes = document.createElement("p");
        notes.className = "sale-detail-notes";
        notes.textContent = sale.notes;
        saleDetailBody.appendChild(notes);
    }

    saleStatusAction.hidden = !getNextStatus(sale.paymentStatus);
    saleStatusAction.disabled = !storageReady;
    cancelSaleAction.hidden = sale.paymentStatus !== "Pending";
    cancelSaleAction.disabled = !storageReady;
    detailDialog.showModal();
}

function setSidebarOpen(isOpen) {
    sidebar.classList.toggle("is-open", isOpen);
    sidebarScrim.classList.toggle("is-open", isOpen);
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

if (!demoMode) {
    products = JSON.parse(document.querySelector("#salesProducts").textContent);
    sales = JSON.parse(document.querySelector("#salesData").textContent);
    populateCustomerOptions(JSON.parse(document.querySelector("#salesCustomerOptions").textContent));
} else {
    try {
        products = loadProducts(readProducts());
        sales = readSales();
        populateCustomerOptions(readCustomerNames());
    } catch (error) {
        storageReady = false;
        newSaleButton.disabled = true;
        showStorageWarning("Saved sales, product or customer data could not be loaded. Clear the SmartStock sample data in browser storage and refresh.", error);
        sales = seededSales.map(function (sale) {
            return Object.assign({}, sale, {
                items: sale.items.map(function (item) {
                    return Object.assign({}, item);
                })
            });
        });
        products = seededProducts.map(function (product) {
            return Object.assign({}, product);
        });
    }
}
renderSales();

newSaleButton.addEventListener("click", function () {
    if (storageReady) {
        openSaleDialog();
    }
});
document.querySelector("#closeSaleDialog").addEventListener("click", function () {
    saleDialog.close();
});
document.querySelector("#cancelSaleDialog").addEventListener("click", function () {
    saleDialog.close();
});
saleDialog.addEventListener("click", function (event) {
    if (event.target === saleDialog) {
        saleDialog.close();
    }
});
if (demoMode) {
    saleForm.addEventListener("submit", handleSaleSubmit);
}
document.querySelector("#addSaleLine").addEventListener("click", function () {
    saleLines.appendChild(createSaleLine());
    updateRemoveLineButtons();
});
saleLines.addEventListener("click", function (event) {
    const removeButton = event.target.closest(".sale-remove-line");
    if (!removeButton || removeButton.disabled) {
        return;
    }
    removeButton.closest("tr").remove();
    updateRemoveLineButtons();
    saleDialogTotal.textContent = formatCurrency(Array.from(saleLines.querySelectorAll("tr")).reduce(function (sum, row) {
        const values = getSaleLineValues(row);
        return values.quantity > 0 && values.unitPrice >= 0 ? sum + values.quantity * values.unitPrice : sum;
    }, 0));
});
saleLines.addEventListener("change", function (event) {
    const row = event.target.closest("tr");
    if (!row) {
        return;
    }
    if (event.target.matches(".sale-product-select")) {
        const product = products.find(function (item) {
            return item.id === event.target.value;
        });
        row.querySelector("[name='unit_price']").value = product ? String(product.sellingPrice) : "";
    }
    updateSaleLineTotal(row);
});
saleLines.addEventListener("input", function (event) {
    const row = event.target.closest("tr");
    if (row && event.target.matches(".sale-line-input")) {
        updateSaleLineTotal(row);
    }
});

salesSearch.addEventListener("input", renderSales);
salesStatusFilter.addEventListener("change", renderSales);
salesRows.addEventListener("click", function (event) {
    const actionButton = event.target.closest("[data-sale-action]");
    if (!actionButton) {
        return;
    }
    const row = actionButton.closest("tr");
    const sale = sales.find(function (item) {
        return item.id === row.dataset.saleId;
    });
    if (!sale) {
        return;
    }
    if (actionButton.dataset.saleAction === "view") {
        openSaleDetails(sale);
        return;
    }
    if (getNextStatus(sale.paymentStatus)) {
        updateSaleStatus(sale.id, "Paid");
    }
});

document.querySelector("#closeSaleDetails").addEventListener("click", function () {
    detailDialog.close();
});
document.querySelector("#closeSaleDetailsFooter").addEventListener("click", function () {
    detailDialog.close();
});
detailDialog.addEventListener("click", function (event) {
    if (event.target === detailDialog) {
        detailDialog.close();
    }
});
saleStatusAction.addEventListener("click", function () {
    if (updateSaleStatus(currentDetailSaleId, "Paid")) {
        detailDialog.close();
    }
});
cancelSaleAction.addEventListener("click", function () {
    const sale = sales.find(function (item) {
        return item.id === currentDetailSaleId;
    });
    if (sale && window.confirm("Cancel invoice " + sale.id + "?")) {
        if (updateSaleStatus(sale.id, "Cancelled")) {
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
resetSaleForm();
