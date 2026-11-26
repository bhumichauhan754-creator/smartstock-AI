"use strict";

const customerStorageKey = "smartstock.sampleCustomers";
const salesStorageKey = "smartstock.sampleSales";
const defaultCustomerNames = [
    "Northside Design Studio",
    "Willow Creek Retail",
    "Brightline Offices",
    "Walk-in customer"
];
const seededCustomers = [
    {
        id: "customer-northside",
        name: "Northside Design Studio",
        customerType: "Business",
        contactName: "Avery Brooks",
        email: "avery@northside.example",
        phone: "+1 (415) 555-0148",
        address: "220 Pine Street, San Francisco, CA",
        notes: "Prefers consolidated monthly invoices.",
        isActive: true
    },
    {
        id: "customer-willow",
        name: "Willow Creek Retail",
        customerType: "Business",
        contactName: "Mason Lee",
        email: "mason@willowcreek.example",
        phone: "+1 (408) 555-0126",
        address: "54 Willow Avenue, San Jose, CA",
        notes: "Bulk office orders.",
        isActive: true
    },
    {
        id: "customer-brightline",
        name: "Brightline Offices",
        customerType: "Business",
        contactName: "Amara Johnson",
        email: "amara@brightline.example",
        phone: "+1 (650) 555-0193",
        address: "800 Redwood Boulevard, Redwood City, CA",
        notes: "Payment terms: 14 days.",
        isActive: true
    },
    {
        id: "customer-walk-in",
        name: "Walk-in customer",
        customerType: "Individual",
        contactName: "Walk-in customer",
        email: "",
        phone: "",
        address: "",
        notes: "Default customer for in-person sales.",
        isActive: true
    }
];
const customerRows = document.querySelector("#customerRows");
const customerSearch = document.querySelector("#customerSearch");
const customerStatusFilter = document.querySelector("#customerStatusFilter");
const customerEmpty = document.querySelector("#customerEmpty");
const customerResults = document.querySelector("#customerResults");
const customerStorageWarning = document.querySelector("#customerStorageWarning");
const customerFeedback = document.querySelector("#customerFeedback");
const customerDialog = document.querySelector("#customerDialog");
const customerForm = document.querySelector("#customerForm");
const demoMode = customerForm.dataset.demo !== "false";
const customerNameInput = document.querySelector("#customerName");
const customerTypeInput = document.querySelector("#customerType");
const customerContactInput = document.querySelector("#customerContact");
const customerEmailInput = document.querySelector("#customerEmail");
const customerPhoneInput = document.querySelector("#customerPhone");
const customerAddressInput = document.querySelector("#customerAddress");
const customerNotesInput = document.querySelector("#customerNotes");
const customerActiveInput = document.querySelector("#customerActive");
const customerNameLockHint = document.querySelector("#customerNameLockHint");
const customerDialogMessage = document.querySelector("#customerDialogMessage");
const addCustomerButton = document.querySelector("#addCustomerButton");
const saveCustomerButton = document.querySelector("#saveCustomerButton");
const customerStats = {
    total: document.querySelector("#totalCustomers"),
    active: document.querySelector("#activeCustomers"),
    openInvoices: document.querySelector("#openCustomerInvoices"),
    archived: document.querySelector("#archivedCustomers")
};
let customers = [];
let sales = [];
let storageReady = true;
let editingCustomerId = "";
let nameLockedForHistory = false;

function showFeedback(message, isError) {
    customerFeedback.textContent = message;
    customerFeedback.classList.add("is-visible");
    customerFeedback.classList.toggle("is-error", Boolean(isError));
}

function clearFeedback() {
    customerFeedback.textContent = "";
    customerFeedback.classList.remove("is-visible", "is-error");
}

function showDialogMessage(message) {
    customerDialogMessage.textContent = message;
    customerDialogMessage.classList.toggle("is-visible", Boolean(message));
}

function copySeededCustomers() {
    return seededCustomers.map(function (customer) {
        return Object.assign({}, customer);
    });
}

function readCustomers() {
    const rawCustomers = window.localStorage.getItem(customerStorageKey);
    if (!rawCustomers) {
        return copySeededCustomers();
    }

    const savedCustomers = JSON.parse(rawCustomers);
    if (!Array.isArray(savedCustomers)) {
        throw new TypeError("Saved sample customers must be stored as a list.");
    }
    const seenIds = new Set();
    savedCustomers.forEach(function (customer) {
        const validCustomer = customer &&
            typeof customer.id === "string" &&
            customer.id.length > 0 &&
            typeof customer.name === "string" &&
            customer.name.trim().length > 0 &&
            ["Business", "Individual"].includes(customer.customerType) &&
            typeof customer.contactName === "string" &&
            typeof customer.email === "string" &&
            typeof customer.phone === "string" &&
            typeof customer.address === "string" &&
            typeof customer.notes === "string" &&
            typeof customer.isActive === "boolean" &&
            !seenIds.has(customer.id);
        if (!validCustomer) {
            throw new TypeError("A saved sample customer has an invalid shape or duplicate ID.");
        }
        seenIds.add(customer.id);
    });
    return savedCustomers;
}

function readSales() {
    const rawSales = window.localStorage.getItem(salesStorageKey);
    if (!rawSales) {
        return [
            { customer: "Northside Design Studio", paymentStatus: "Paid", total: 361.95 },
            { customer: "Willow Creek Retail", paymentStatus: "Paid", total: 438 },
            { customer: "Brightline Offices", paymentStatus: "Pending", total: 168.95 },
            { customer: "Walk-in customer", paymentStatus: "Cancelled", total: 99 },
            { customer: "Northside Design Studio", paymentStatus: "Pending", total: 115 }
        ];
    }
    const savedSales = JSON.parse(rawSales);
    if (!Array.isArray(savedSales) || savedSales.some(function (sale) {
        return !sale || typeof sale.customer !== "string" ||
            !["Pending", "Paid", "Cancelled"].includes(sale.paymentStatus) ||
            !Number.isFinite(sale.total);
    })) {
        throw new TypeError("Saved sample sales have an invalid shape.");
    }
    return savedSales;
}

function getSalesForCustomer(customer) {
    return sales.filter(function (sale) {
        return sale.customer === customer.name;
    });
}

function customerHasHistory(customer) {
    return getSalesForCustomer(customer).length > 0;
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
    }).format(value);
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

function createActionButton(action, customer, label, pathData, disabled, title) {
    const button = document.createElement("button");
    button.className = "customer-action-button";
    button.type = "button";
    button.dataset.customerAction = action;
    button.dataset.customerId = customer.id;
    button.setAttribute("aria-label", label);
    if (disabled) {
        button.disabled = true;
    }
    if (title) {
        button.title = title;
    }
    button.appendChild(createSvgIcon(pathData));
    return button;
}

function createCustomerRow(customer) {
    const row = document.createElement("tr");
    row.dataset.customerId = customer.id;

    const nameCell = document.createElement("td");
    const nameWrap = document.createElement("div");
    nameWrap.className = "customer-name-cell";
    const avatar = document.createElement("span");
    avatar.className = "customer-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = customer.name.trim().split(/\s+/).slice(0, 2).map(function (word) {
        return word.charAt(0);
    }).join("").toUpperCase();
    const nameCopy = document.createElement("span");
    nameCopy.className = "customer-name-copy";
    const name = document.createElement("strong");
    name.textContent = customer.name;
    const type = document.createElement("small");
    type.textContent = customer.customerType;
    nameCopy.append(name, type);
    nameWrap.append(avatar, nameCopy);
    nameCell.appendChild(nameWrap);
    row.appendChild(nameCell);

    const contactCell = document.createElement("td");
    const contactCopy = document.createElement("span");
    contactCopy.className = "customer-contact-copy";
    const contactName = document.createElement("strong");
    contactName.textContent = customer.contactName;
    const contactNote = document.createElement("small");
    contactNote.textContent = customer.notes || "No notes";
    contactCopy.append(contactName, contactNote);
    contactCell.appendChild(contactCopy);
    row.appendChild(contactCell);

    const contactDetails = document.createElement("td");
    const emailPhone = document.createElement("span");
    emailPhone.className = "customer-email-phone";
    if (customer.email) {
        const email = document.createElement("a");
        email.href = "mailto:" + customer.email;
        email.textContent = customer.email;
        emailPhone.appendChild(email);
    } else {
        const noEmail = document.createElement("small");
        noEmail.textContent = "Email not provided";
        emailPhone.appendChild(noEmail);
    }
    if (customer.phone) {
        const phone = document.createElement("a");
        phone.href = "tel:" + customer.phone.replace(/[^\d+]/g, "");
        phone.textContent = customer.phone;
        emailPhone.appendChild(phone);
    } else {
        const noPhone = document.createElement("small");
        noPhone.textContent = "Phone not provided";
        emailPhone.appendChild(noPhone);
    }
    contactDetails.appendChild(emailPhone);
    row.appendChild(contactDetails);

    const activityCell = document.createElement("td");
    const customerSales = getSalesForCustomer(customer);
    const invoiceCount = document.createElement("span");
    invoiceCount.className = "customer-invoice-count";
    invoiceCount.textContent = String(customerSales.length);
    invoiceCount.setAttribute("aria-label", customerSales.length + " invoices");
    const lifetimeSales = customerSales.filter(function (sale) {
        return sale.paymentStatus !== "Cancelled";
    }).reduce(function (total, sale) {
        return total + sale.total;
    }, 0);
    const salesAmount = document.createElement("small");
    salesAmount.className = "customer-sales-amount";
    salesAmount.textContent = formatCurrency(lifetimeSales) + " sales";
    activityCell.append(invoiceCount, salesAmount);
    row.appendChild(activityCell);

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = "customer-status " + (customer.isActive ? "is-active" : "is-archived");
    status.textContent = customer.isActive ? "Active" : "Archived";
    statusCell.appendChild(status);
    row.appendChild(statusCell);

    const actionCell = document.createElement("td");
    const actions = document.createElement("span");
    actions.className = "customer-row-actions";
    actions.appendChild(createActionButton(
        "edit",
        customer,
        "Edit " + customer.name,
        "m14 5 5 5M4 20l4.3-.9L19 8.4a2.1 2.1 0 0 0-3-3L5.3 16.1 4 20Z",
        !storageReady
    ));
    actions.appendChild(createActionButton(
        customer.isActive ? "archive" : "restore",
        customer,
        (customer.isActive ? "Archive " : "Restore ") + customer.name,
        customer.isActive
            ? "M4 7h16M7 7V5h10v2m-11 0 1 13h10l1-13M10 11v5m4-5v5"
            : "M12 19V5m0 0L6.5 10.5M12 5l5.5 5.5M5 19h14",
        !storageReady
    ));
    const hasHistory = customerHasHistory(customer);
    actions.appendChild(createActionButton(
        "delete",
        customer,
        "Delete " + customer.name,
        "M4 7h16M7 7V5h10v2m-11 0 1 13h10l1-13M10 11v5m4-5v5",
        !storageReady || hasHistory,
        hasHistory ? "Cannot delete a customer with linked invoice history. Archive it instead." : ""
    ));
    actionCell.appendChild(actions);
    row.appendChild(actionCell);
    return row;
}

function renderCustomers() {
    const query = customerSearch.value.trim().toLowerCase();
    const statusFilter = customerStatusFilter.value;
    const visibleCustomers = customers.filter(function (customer) {
        const matchesQuery = !query ||
            customer.name.toLowerCase().includes(query) ||
            customer.contactName.toLowerCase().includes(query) ||
            customer.email.toLowerCase().includes(query) ||
            customer.phone.toLowerCase().includes(query);
        const matchesStatus = !statusFilter ||
            (statusFilter === "active" && customer.isActive) ||
            (statusFilter === "archived" && !customer.isActive);
        return matchesQuery && matchesStatus;
    });

    customerRows.replaceChildren(...visibleCustomers.map(createCustomerRow));
    customerEmpty.hidden = visibleCustomers.length > 0;
    customerResults.textContent = "Showing " + visibleCustomers.length + " of " + customers.length + " customers";
    customerStats.total.textContent = String(customers.length);
    customerStats.active.textContent = String(customers.filter(function (customer) {
        return customer.isActive;
    }).length);
    customerStats.archived.textContent = String(customers.filter(function (customer) {
        return !customer.isActive;
    }).length);
    customerStats.openInvoices.textContent = String(sales.filter(function (sale) {
        return sale.paymentStatus === "Pending";
    }).length);
}

function persistCustomers(nextCustomers) {
    try {
        window.localStorage.setItem(customerStorageKey, JSON.stringify(nextCustomers));
    } catch (error) {
        console.error("Could not save sample customers.", error);
        showFeedback("Customer changes could not be saved in browser storage. Check available storage and try again.", true);
        return false;
    }
    customers = nextCustomers;
    renderCustomers();
    return true;
}

function closeCustomerDialog() {
    customerDialog.close();
}

function openCustomerDialog(customer) {
    clearFeedback();
    showDialogMessage("");
    customerForm.reset();
    editingCustomerId = customer ? customer.id : "";
    customerForm.action = customer
        ? "/customers/" + encodeURIComponent(customer.id) + "/edit/"
        : "/customers/add/";
    nameLockedForHistory = Boolean(customer && customerHasHistory(customer));
    customerNameInput.readOnly = nameLockedForHistory;
    customerNameLockHint.hidden = !nameLockedForHistory;
    document.querySelector("#customerDialogTitle").textContent = customer ? "Edit customer" : "Add customer";
    document.querySelector("#customerDialogSubtitle").textContent = customer
        ? "Update customer contact and account details."
        : "Save customer and contact details.";
    saveCustomerButton.textContent = customer ? "Save changes" : "Save customer";
    if (customer) {
        customerNameInput.value = customer.name;
        customerTypeInput.value = customer.customerType;
        customerContactInput.value = customer.contactName;
        customerEmailInput.value = customer.email;
        customerPhoneInput.value = customer.phone;
        customerAddressInput.value = customer.address;
        customerNotesInput.value = customer.notes;
        customerActiveInput.checked = customer.isActive;
    } else {
        customerActiveInput.checked = true;
    }
    customerDialog.showModal();
    customerNameInput.focus();
}

function handleCustomerSubmit(event) {
    event.preventDefault();
    showDialogMessage("");
    if (!storageReady) {
        showDialogMessage("Customer data is read-only because saved sample data could not be loaded.");
        return;
    }
    if (!customerForm.checkValidity()) {
        customerForm.reportValidity();
        return;
    }

    const existingCustomer = customers.find(function (customer) {
        return customer.id === editingCustomerId;
    });
    const name = customerNameInput.value.trim();
    const contactName = customerContactInput.value.trim();
    const email = customerEmailInput.value.trim();
    if (!name || !contactName) {
        showDialogMessage("Enter a customer name and contact person.");
        return;
    }
    if (nameLockedForHistory && existingCustomer && name !== existingCustomer.name) {
        showDialogMessage("The customer name cannot change while invoice history is linked.");
        return;
    }
    const duplicateCustomer = customers.find(function (customer) {
        return customer.id !== editingCustomerId &&
            (customer.name.toLowerCase() === name.toLowerCase() ||
                (email && customer.email && customer.email.toLowerCase() === email.toLowerCase()));
    });
    if (duplicateCustomer) {
        showDialogMessage(
            duplicateCustomer.name.toLowerCase() === name.toLowerCase()
                ? "A customer with this name already exists."
                : "A customer with this email address already exists."
        );
        return;
    }

    const updatedCustomer = {
        id: existingCustomer ? existingCustomer.id : "customer-" + Date.now().toString(36),
        name: name,
        customerType: customerTypeInput.value,
        contactName: contactName,
        email: email,
        phone: customerPhoneInput.value.trim(),
        address: customerAddressInput.value.trim(),
        notes: customerNotesInput.value.trim(),
        isActive: customerActiveInput.checked
    };
    const nextCustomers = existingCustomer
        ? customers.map(function (customer) {
            return customer.id === existingCustomer.id ? updatedCustomer : customer;
        })
        : customers.concat(updatedCustomer);

    if (persistCustomers(nextCustomers)) {
        closeCustomerDialog();
        showFeedback(existingCustomer ? "Customer details updated." : "Customer added to your directory.", false);
    }
}

function handleCustomerAction(action, customer) {
    if (action === "edit") {
        openCustomerDialog(customer);
        return;
    }
    if (action === "archive" || action === "restore") {
        const nextActive = action === "restore";
        const prompt = nextActive
            ? "Restore " + customer.name + " as an active customer?"
            : "Archive " + customer.name + "? Existing invoice history will be kept.";
        if (!window.confirm(prompt)) {
            return;
        }
        if (!demoMode) {
            submitCustomerAction(customer.id, "status", { active: String(nextActive) });
            return;
        }
        const nextCustomers = customers.map(function (item) {
            return item.id === customer.id ? Object.assign({}, item, { isActive: nextActive }) : item;
        });
        if (persistCustomers(nextCustomers)) {
            showFeedback(nextActive ? "Customer restored." : "Customer archived. Existing invoice history is unchanged.", false);
        }
        return;
    }
    if (action === "delete") {
        if (customerHasHistory(customer)) {
            showFeedback("This customer has linked invoice history and cannot be deleted. Archive it instead.", true);
            return;
        }
        if (!window.confirm("Permanently delete " + customer.name + " from the sample directory?")) {
            return;
        }
        if (!demoMode) {
            submitCustomerAction(customer.id, "delete");
            return;
        }
        if (persistCustomers(customers.filter(function (item) {
            return item.id !== customer.id;
        }))) {
            showFeedback("Customer deleted.", false);
        }

        function submitCustomerAction(customerId, action, values) {
            const form = document.createElement("form");
            form.method = "post";
            form.action = "/customers/" + encodeURIComponent(customerId) + "/" + action + "/";
            const csrfInput = document.createElement("input");
            csrfInput.type = "hidden";
            csrfInput.name = "csrfmiddlewaretoken";
            csrfInput.value = customerForm.querySelector("[name='csrfmiddlewaretoken']").value;
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
    console.error("Could not load sample customer or sales history.", error);
    customerStorageWarning.textContent = "Saved customer or sales data could not be loaded. Customer changes are disabled to protect the existing sample records. Clear the SmartStock sample data in browser storage and refresh.";
    customerStorageWarning.hidden = false;
    addCustomerButton.disabled = true;
}

if (!demoMode) {
    customers = JSON.parse(document.querySelector("#customerData").textContent);
    sales = JSON.parse(document.querySelector("#customerSalesData").textContent);
} else {
    try {
        customers = readCustomers();
        sales = readSales();
    } catch (error) {
        showStorageWarning(error);
        customers = copySeededCustomers();
        sales = [];
    }
}
renderCustomers();

addCustomerButton.addEventListener("click", function () {
    if (storageReady) {
        openCustomerDialog(null);
    }
});
document.querySelector("#closeCustomerDialog").addEventListener("click", closeCustomerDialog);
document.querySelector("#cancelCustomerDialog").addEventListener("click", closeCustomerDialog);
customerDialog.addEventListener("click", function (event) {
    if (event.target === customerDialog) {
        closeCustomerDialog();
    }
});
if (demoMode) {
    customerForm.addEventListener("submit", handleCustomerSubmit);
}
customerSearch.addEventListener("input", renderCustomers);
customerStatusFilter.addEventListener("change", renderCustomers);
customerRows.addEventListener("click", function (event) {
    const actionButton = event.target.closest("[data-customer-action]");
    if (!actionButton || actionButton.disabled) {
        return;
    }
    const customer = customers.find(function (item) {
        return item.id === actionButton.dataset.customerId;
    });
    if (customer) {
        clearFeedback();
        handleCustomerAction(actionButton.dataset.customerAction, customer);
    }
});
customerNameInput.addEventListener("input", function () {
    customerNameInput.removeAttribute("aria-invalid");
});
customerEmailInput.addEventListener("input", function () {
    customerEmailInput.removeAttribute("aria-invalid");
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
