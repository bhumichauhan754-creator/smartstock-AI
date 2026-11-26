"use strict";

const supplierStorageKey = "smartstock.sampleSuppliers";
const purchaseStorageKey = "smartstock.samplePurchases";
const stockReceiptStorageKey = "smartstock.sampleStockReceipts";
const defaultSupplierNames = [
    "Acme Supply Co.",
    "TechSource Distributors",
    "Office Hub Wholesale",
    "Metro Packaging"
];
const seededSuppliers = [
    {
        id: "supplier-acme",
        name: "Acme Supply Co.",
        contactName: "Olivia Chen",
        email: "olivia@acmesupply.example",
        phone: "+1 (415) 555-0132",
        address: "1420 Market Street, San Francisco, CA",
        notes: "Standard deliveries arrive in the morning.",
        isActive: true
    },
    {
        id: "supplier-techsource",
        name: "TechSource Distributors",
        contactName: "Ivan Patel",
        email: "ivan@techsource.example",
        phone: "+1 (408) 555-0168",
        address: "86 North First Street, San Jose, CA",
        notes: "Confirm dispatch before shipping.",
        isActive: true
    },
    {
        id: "supplier-officehub",
        name: "Office Hub Wholesale",
        contactName: "Grace Miller",
        email: "grace@officehub.example",
        phone: "+1 (650) 555-0184",
        address: "415 Harbor Way, Redwood City, CA",
        notes: "",
        isActive: true
    },
    {
        id: "supplier-metro",
        name: "Metro Packaging",
        contactName: "Noah Williams",
        email: "noah@metro-packaging.example",
        phone: "+1 (510) 555-0117",
        address: "780 Industrial Road, Oakland, CA",
        notes: "Ships packaging supplies in consolidated orders.",
        isActive: true
    }
];
const supplierRows = document.querySelector("#supplierRows");
const supplierSearch = document.querySelector("#supplierSearch");
const supplierStatusFilter = document.querySelector("#supplierStatusFilter");
const supplierEmpty = document.querySelector("#supplierEmpty");
const supplierResults = document.querySelector("#supplierResults");
const supplierStorageWarning = document.querySelector("#supplierStorageWarning");
const supplierFeedback = document.querySelector("#supplierFeedback");
const supplierDialog = document.querySelector("#supplierDialog");
const supplierForm = document.querySelector("#supplierForm");
const demoMode = supplierForm.dataset.demo !== "false";
const supplierDialogTitle = document.querySelector("#supplierDialogTitle");
const supplierDialogSubtitle = document.querySelector("#supplierDialogSubtitle");
const supplierNameInput = document.querySelector("#supplierName");
const supplierContactInput = document.querySelector("#supplierContact");
const supplierEmailInput = document.querySelector("#supplierEmail");
const supplierPhoneInput = document.querySelector("#supplierPhone");
const supplierAddressInput = document.querySelector("#supplierAddress");
const supplierNotesInput = document.querySelector("#supplierNotes");
const supplierActiveInput = document.querySelector("#supplierActive");
const supplierNameLockHint = document.querySelector("#supplierNameLockHint");
const supplierDialogMessage = document.querySelector("#supplierDialogMessage");
const addSupplierButton = document.querySelector("#addSupplierButton");
const saveSupplierButton = document.querySelector("#saveSupplierButton");
const supplierStats = {
    total: document.querySelector("#totalSuppliers"),
    active: document.querySelector("#activeSuppliers"),
    openOrders: document.querySelector("#openSupplierOrders"),
    archived: document.querySelector("#archivedSuppliers")
};
let suppliers = [];
let purchaseOrders = [];
let stockReceipts = [];
let storageReady = true;
let editingSupplierId = "";
let nameLockedForHistory = false;

function showFeedback(message, isError) {
    supplierFeedback.textContent = message;
    supplierFeedback.classList.add("is-visible");
    supplierFeedback.classList.toggle("is-error", Boolean(isError));
}

function clearFeedback() {
    supplierFeedback.textContent = "";
    supplierFeedback.classList.remove("is-visible", "is-error");
}

function showDialogMessage(message) {
    supplierDialogMessage.textContent = message;
    supplierDialogMessage.classList.toggle("is-visible", Boolean(message));
}

function copySeededSuppliers() {
    return seededSuppliers.map(function (supplier) {
        return Object.assign({}, supplier);
    });
}

function readSuppliers() {
    const rawSuppliers = window.localStorage.getItem(supplierStorageKey);
    if (!rawSuppliers) {
        return copySeededSuppliers();
    }

    const savedSuppliers = JSON.parse(rawSuppliers);
    if (!Array.isArray(savedSuppliers)) {
        throw new TypeError("Saved sample suppliers must be stored as a list.");
    }

    const seenIds = new Set();
    savedSuppliers.forEach(function (supplier) {
        const validSupplier = supplier &&
            typeof supplier.id === "string" &&
            supplier.id.length > 0 &&
            typeof supplier.name === "string" &&
            supplier.name.trim().length > 0 &&
            typeof supplier.contactName === "string" &&
            typeof supplier.email === "string" &&
            typeof supplier.phone === "string" &&
            typeof supplier.address === "string" &&
            typeof supplier.notes === "string" &&
            typeof supplier.isActive === "boolean" &&
            !seenIds.has(supplier.id);

        if (!validSupplier) {
            throw new TypeError("A saved sample supplier has an invalid shape or duplicate ID.");
        }
        seenIds.add(supplier.id);
    });

    return savedSuppliers;
}

function readPurchaseOrders() {
    const rawOrders = window.localStorage.getItem(purchaseStorageKey);
    if (!rawOrders) {
        return [
            { supplier: "TechSource Distributors", status: "Ordered" },
            { supplier: "Acme Supply Co.", status: "Received" },
            { supplier: "Office Hub Wholesale", status: "Draft" },
            { supplier: "Metro Packaging", status: "Cancelled" },
            { supplier: "TechSource Distributors", status: "Received" }
        ];
    }

    const savedOrders = JSON.parse(rawOrders);
    if (!Array.isArray(savedOrders) || savedOrders.some(function (order) {
        return !order || typeof order.supplier !== "string" ||
            !["Draft", "Ordered", "Received", "Cancelled"].includes(order.status);
    })) {
        throw new TypeError("Saved sample purchase orders have an invalid shape.");
    }
    return savedOrders;
}

function readStockReceipts() {
    const rawReceipts = window.localStorage.getItem(stockReceiptStorageKey);
    if (!rawReceipts) {
        return [];
    }

    const savedReceipts = JSON.parse(rawReceipts);
    if (!Array.isArray(savedReceipts) || savedReceipts.some(function (receipt) {
        return !receipt || typeof receipt.supplier !== "string";
    })) {
        throw new TypeError("Saved sample stock receipts have an invalid shape.");
    }
    return savedReceipts;
}

function supplierHasHistory(supplier) {
    return purchaseOrders.some(function (order) {
        return order.supplier === supplier.name;
    }) || stockReceipts.some(function (receipt) {
        return receipt.supplier === supplier.name;
    });
}

function getOrdersForSupplier(supplier) {
    return purchaseOrders.filter(function (order) {
        return order.supplier === supplier.name;
    });
}

function createSvgIcon(pathData) {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.7");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    icon.appendChild(path);
    return icon;
}

function createActionButton(action, supplier, label, pathMarkup, disabled, title) {
    const button = document.createElement("button");
    button.className = "supplier-action-button";
    button.type = "button";
    button.dataset.supplierAction = action;
    button.dataset.supplierId = supplier.id;
    button.setAttribute("aria-label", label);
    if (disabled) {
        button.disabled = true;
    }
    if (title) {
        button.title = title;
    }
    button.appendChild(createSvgIcon(pathMarkup));
    return button;
}

function createSupplierRow(supplier) {
    const row = document.createElement("tr");
    row.dataset.supplierId = supplier.id;

    const companyCell = document.createElement("td");
    const company = document.createElement("div");
    company.className = "supplier-company";
    const avatar = document.createElement("span");
    avatar.className = "supplier-company-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = supplier.name.trim().split(/\s+/).slice(0, 2).map(function (word) {
        return word.charAt(0);
    }).join("").toUpperCase();
    const companyCopy = document.createElement("span");
    companyCopy.className = "supplier-company-copy";
    const companyName = document.createElement("strong");
    companyName.textContent = supplier.name;
    const companyAddress = document.createElement("small");
    companyAddress.textContent = supplier.address || "Address not provided";
    companyCopy.append(companyName, companyAddress);
    company.append(avatar, companyCopy);
    companyCell.appendChild(company);
    row.appendChild(companyCell);

    const contactCell = document.createElement("td");
    const contactCopy = document.createElement("span");
    contactCopy.className = "supplier-contact-copy";
    const contactName = document.createElement("strong");
    contactName.textContent = supplier.contactName;
    const notes = document.createElement("small");
    notes.textContent = supplier.notes || "No notes";
    contactCopy.append(contactName, notes);
    contactCell.appendChild(contactCopy);
    row.appendChild(contactCell);

    const emailPhoneCell = document.createElement("td");
    const emailPhone = document.createElement("span");
    emailPhone.className = "supplier-email-phone";
    const email = document.createElement("a");
    email.href = "mailto:" + supplier.email;
    email.textContent = supplier.email;
    const phone = document.createElement("a");
    phone.href = supplier.phone ? "tel:" + supplier.phone.replace(/[^\d+]/g, "") : "#";
    phone.textContent = supplier.phone || "Phone not provided";
    if (!supplier.phone) {
        phone.removeAttribute("href");
    }
    emailPhone.append(email, phone);
    emailPhoneCell.appendChild(emailPhone);
    row.appendChild(emailPhoneCell);

    const orderCell = document.createElement("td");
    const orderList = getOrdersForSupplier(supplier);
    const orderCount = document.createElement("span");
    orderCount.className = "supplier-order-count";
    orderCount.textContent = String(orderList.length);
    orderCount.setAttribute("aria-label", orderList.length + " purchase orders");
    const openCount = orderList.filter(function (order) {
        return order.status === "Draft" || order.status === "Ordered";
    }).length;
    const openNote = document.createElement("small");
    openNote.className = "supplier-order-note";
    openNote.textContent = openCount + " open";
    orderCell.append(orderCount, document.createTextNode(" "), openNote);
    row.appendChild(orderCell);

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "supplier-status " + (supplier.isActive ? "is-active" : "is-archived");
    status.textContent = supplier.isActive ? "Active" : "Archived";
    statusCell.appendChild(status);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");
    const actions = document.createElement("span");
    actions.className = "supplier-row-actions";
    actions.appendChild(createActionButton(
        "edit",
        supplier,
        "Edit " + supplier.name,
        "m14 5 5 5M4 20l4.3-.9L19 8.4a2.1 2.1 0 0 0-3-3L5.3 16.1 4 20Z",
        !storageReady
    ));
    actions.appendChild(createActionButton(
        supplier.isActive ? "archive" : "restore",
        supplier,
        (supplier.isActive ? "Archive " : "Restore ") + supplier.name,
        supplier.isActive
            ? "M4 7h16M7 7V5h10v2m-11 0 1 13h10l1-13M10 11v5m4-5v5"
            : "M12 19V5m0 0L6.5 10.5M12 5l5.5 5.5M5 19h14",
        !storageReady
    ));
    const hasHistory = supplierHasHistory(supplier);
    actions.appendChild(createActionButton(
        "delete",
        supplier,
        "Delete " + supplier.name,
        "M4 7h16M7 7V5h10v2m-11 0 1 13h10l1-13M10 11v5m4-5v5",
        !storageReady || hasHistory,
        hasHistory ? "Cannot delete a supplier with linked purchase or receipt history. Archive it instead." : ""
    ));
    actionCell.appendChild(actions);
    row.appendChild(actionCell);
    return row;
}

function renderSuppliers() {
    const query = supplierSearch.value.trim().toLowerCase();
    const statusFilter = supplierStatusFilter.value;
    const visibleSuppliers = suppliers.filter(function (supplier) {
        const matchesQuery = !query ||
            supplier.name.toLowerCase().includes(query) ||
            supplier.contactName.toLowerCase().includes(query) ||
            supplier.email.toLowerCase().includes(query) ||
            supplier.phone.toLowerCase().includes(query);
        const matchesStatus = !statusFilter ||
            (statusFilter === "active" && supplier.isActive) ||
            (statusFilter === "archived" && !supplier.isActive);
        return matchesQuery && matchesStatus;
    });

    supplierRows.replaceChildren(...visibleSuppliers.map(createSupplierRow));
    supplierEmpty.hidden = visibleSuppliers.length > 0;
    supplierResults.textContent = "Showing " + visibleSuppliers.length + " of " + suppliers.length + " suppliers";
    supplierStats.total.textContent = String(suppliers.length);
    supplierStats.active.textContent = String(suppliers.filter(function (supplier) {
        return supplier.isActive;
    }).length);
    supplierStats.archived.textContent = String(suppliers.filter(function (supplier) {
        return !supplier.isActive;
    }).length);
    supplierStats.openOrders.textContent = String(purchaseOrders.filter(function (order) {
        return order.status === "Draft" || order.status === "Ordered";
    }).length);
}

function persistSuppliers(nextSuppliers) {
    try {
        window.localStorage.setItem(supplierStorageKey, JSON.stringify(nextSuppliers));
    } catch (error) {
        console.error("Could not save sample suppliers.", error);
        showFeedback("Supplier changes could not be saved in browser storage. Check available storage and try again.", true);
        return false;
    }

    suppliers = nextSuppliers;
    renderSuppliers();
    return true;
}

function closeSupplierDialog() {
    supplierDialog.close();
}

function openSupplierDialog(supplier) {
    clearFeedback();
    showDialogMessage("");
    supplierForm.reset();
    editingSupplierId = supplier ? supplier.id : "";
    supplierForm.action = supplier
        ? "/suppliers/" + encodeURIComponent(supplier.id) + "/edit/"
        : "/suppliers/add/";
    nameLockedForHistory = Boolean(supplier && supplierHasHistory(supplier));
    supplierDialogTitle.textContent = supplier ? "Edit supplier" : "Add supplier";
    supplierDialogSubtitle.textContent = supplier
        ? "Update supplier contact and account details."
        : "Save a new supplier and contact details.";
    supplierNameInput.readOnly = nameLockedForHistory;
    supplierNameLockHint.hidden = !nameLockedForHistory;
    saveSupplierButton.textContent = supplier ? "Save changes" : "Save supplier";

    if (supplier) {
        supplierNameInput.value = supplier.name;
        supplierContactInput.value = supplier.contactName;
        supplierEmailInput.value = supplier.email;
        supplierPhoneInput.value = supplier.phone;
        supplierAddressInput.value = supplier.address;
        supplierNotesInput.value = supplier.notes;
        supplierActiveInput.checked = supplier.isActive;
    } else {
        supplierActiveInput.checked = true;
    }

    supplierDialog.showModal();
    supplierNameInput.focus();
}

function handleSupplierSubmit(event) {
    event.preventDefault();
    showDialogMessage("");
    if (!storageReady) {
        showDialogMessage("Supplier data is read-only because saved sample data could not be loaded.");
        return;
    }
    if (!supplierForm.checkValidity()) {
        supplierForm.reportValidity();
        return;
    }

    const existingSupplier = suppliers.find(function (supplier) {
        return supplier.id === editingSupplierId;
    });
    const name = supplierNameInput.value.trim();
    const contactName = supplierContactInput.value.trim();
    const email = supplierEmailInput.value.trim();
    const duplicateSupplier = suppliers.find(function (supplier) {
        return supplier.id !== editingSupplierId &&
            (supplier.name.toLowerCase() === name.toLowerCase() ||
                supplier.email.toLowerCase() === email.toLowerCase());
    });

    if (nameLockedForHistory && existingSupplier && name !== existingSupplier.name) {
        showDialogMessage("The company name cannot change while purchase or receipt history is linked.");
        return;
    }
    if (!name || !contactName || !email) {
        showDialogMessage("Enter a company name, contact person, and valid email address.");
        return;
    }
    if (duplicateSupplier) {
        showDialogMessage(
            duplicateSupplier.name.toLowerCase() === name.toLowerCase()
                ? "A supplier with this company name already exists."
                : "A supplier with this email address already exists."
        );
        return;
    }

    const updatedSupplier = {
        id: existingSupplier ? existingSupplier.id : "supplier-" + Date.now().toString(36),
        name: name,
        contactName: contactName,
        email: email,
        phone: supplierPhoneInput.value.trim(),
        address: supplierAddressInput.value.trim(),
        notes: supplierNotesInput.value.trim(),
        isActive: supplierActiveInput.checked
    };
    const nextSuppliers = existingSupplier
        ? suppliers.map(function (supplier) {
            return supplier.id === existingSupplier.id ? updatedSupplier : supplier;
        })
        : suppliers.concat(updatedSupplier);

    if (persistSuppliers(nextSuppliers)) {
        closeSupplierDialog();
        showFeedback(existingSupplier ? "Supplier details updated." : "Supplier added to your directory.", false);
    }
}

function handleSupplierAction(action, supplier) {
    if (action === "edit") {
        openSupplierDialog(supplier);
        return;
    }

    if (action === "archive" || action === "restore") {
        const nextActive = action === "restore";
        const prompt = nextActive
            ? "Restore " + supplier.name + " as an active supplier?"
            : "Archive " + supplier.name + "? Existing purchase history will be kept.";
        if (!window.confirm(prompt)) {
            return;
        }
        if (!demoMode) {
            submitSupplierAction(supplier.id, "status", { active: String(nextActive) });
            return;
        }
        const nextSuppliers = suppliers.map(function (item) {
            return item.id === supplier.id ? Object.assign({}, item, { isActive: nextActive }) : item;
        });
        if (persistSuppliers(nextSuppliers)) {
            showFeedback(nextActive ? "Supplier restored." : "Supplier archived. Existing history is unchanged.", false);
        }
        return;
    }

    if (action === "delete") {
        if (supplierHasHistory(supplier)) {
            showFeedback("This supplier has linked history and cannot be deleted. Archive it instead.", true);
            return;
        }
        if (!window.confirm("Permanently delete " + supplier.name + " from the sample directory?")) {
            return;
        }
        if (!demoMode) {
            submitSupplierAction(supplier.id, "delete");
            return;
        }
        if (persistSuppliers(suppliers.filter(function (item) {
            return item.id !== supplier.id;
        }))) {
            showFeedback("Supplier deleted.", false);
        }

        function submitSupplierAction(supplierId, action, values) {
            const form = document.createElement("form");
            form.method = "post";
            form.action = "/suppliers/" + encodeURIComponent(supplierId) + "/" + action + "/";
            const csrfInput = document.createElement("input");
            csrfInput.type = "hidden";
            csrfInput.name = "csrfmiddlewaretoken";
            csrfInput.value = supplierForm.querySelector("[name='csrfmiddlewaretoken']").value;
            form.appendChild(csrfInput);
            Object.entries(values || {}).forEach(function (entry) {
                const input = document.createElement("input");
                input.type = "hidden";
                input.name = entry[0];
                input.value = entry[1];
                form.appendChild(input);
            });
            document.body.appendChild(form);
            form.submit();
        }
    }
}

function setSidebarOpen(isOpen) {
    sidebar.classList.toggle("is-open", isOpen);
    sidebarScrim.classList.toggle("is-open", isOpen);
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

function showStorageWarning(error) {
    storageReady = false;
    console.error("Could not load sample supplier or purchasing history.", error);
    supplierStorageWarning.textContent = "Saved supplier or purchase data could not be loaded. Supplier changes are disabled to protect the existing sample records. Clear the SmartStock sample data in browser storage and refresh.";
    supplierStorageWarning.hidden = false;
    addSupplierButton.disabled = true;
}

if (!demoMode) {
    suppliers = JSON.parse(document.querySelector("#supplierData").textContent);
    purchaseOrders = JSON.parse(document.querySelector("#supplierPurchaseData").textContent);
    stockReceipts = JSON.parse(document.querySelector("#supplierReceiptData").textContent);
} else {
    try {
        suppliers = readSuppliers();
        purchaseOrders = readPurchaseOrders();
        stockReceipts = readStockReceipts();
    } catch (error) {
        showStorageWarning(error);
        suppliers = copySeededSuppliers();
        purchaseOrders = [];
        stockReceipts = [];
    }
}
renderSuppliers();

addSupplierButton.addEventListener("click", function () {
    if (storageReady) {
        openSupplierDialog(null);
    }
});
document.querySelector("#closeSupplierDialog").addEventListener("click", closeSupplierDialog);
document.querySelector("#cancelSupplierDialog").addEventListener("click", closeSupplierDialog);
supplierDialog.addEventListener("click", function (event) {
    if (event.target === supplierDialog) {
        closeSupplierDialog();
    }
});
if (demoMode) {
    supplierForm.addEventListener("submit", handleSupplierSubmit);
}
supplierSearch.addEventListener("input", renderSuppliers);
supplierStatusFilter.addEventListener("change", renderSuppliers);
supplierRows.addEventListener("click", function (event) {
    const actionButton = event.target.closest("[data-supplier-action]");
    if (!actionButton || actionButton.disabled) {
        return;
    }
    const supplier = suppliers.find(function (item) {
        return item.id === actionButton.dataset.supplierId;
    });
    if (supplier) {
        clearFeedback();
        handleSupplierAction(actionButton.dataset.supplierAction, supplier);
    }
});
supplierNameInput.addEventListener("input", function () {
    supplierNameInput.removeAttribute("aria-invalid");
});
supplierEmailInput.addEventListener("input", function () {
    supplierEmailInput.removeAttribute("aria-invalid");
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
