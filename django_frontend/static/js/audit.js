"use strict";

const auditSearch = document.querySelector("#auditSearch");
const auditModuleFilter = document.querySelector("#auditModuleFilter");
const auditActionFilter = document.querySelector("#auditActionFilter");
const auditDateFilter = document.querySelector("#auditDateFilter");
const auditRows = document.querySelector("#auditRows");
const auditEmpty = document.querySelector("#auditEmpty");
const auditResults = document.querySelector("#auditResults");
const auditFeedback = document.querySelector("#auditFeedback");

function hoursAgo(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

const auditEvents = document.body.dataset.demo === "false"
    ? JSON.parse(document.querySelector("#auditData").textContent)
    : [
    { timestamp: hoursAgo(1), user: "Bhumi Chauhan", initials: "BC", avatar: "blue", action: "updated", actionLabel: "Product updated", module: "Products", record: "Wireless Headphones", reference: "ELEC-001", details: "Selling price updated from ₹74.00 to ₹79.00." },
    { timestamp: hoursAgo(3), user: "Bhumi Chauhan", initials: "BC", avatar: "blue", action: "stock", actionLabel: "Stock received", module: "Stock", record: "Wireless Mouse", reference: "GRN-2026-023", details: "25 units received from Acme Supply Co." },
    { timestamp: hoursAgo(5), user: "Arjun Patel", initials: "AP", avatar: "purple", action: "created", actionLabel: "Invoice created", module: "Sales", record: "INV-2026-106", reference: "Northside Design Studio", details: "Sales invoice created for ₹361.95." },
    { timestamp: hoursAgo(8), user: "Bhumi Chauhan", initials: "BC", avatar: "blue", action: "status", actionLabel: "Status changed", module: "Purchases", record: "PO-2026-041", reference: "TechSource Distributors", details: "Purchase order status changed from Draft to Ordered." },
    { timestamp: hoursAgo(16), user: "System", initials: "SY", avatar: "grey", action: "updated", actionLabel: "Stock alert", module: "Products", record: "USB-C Hub", reference: "ACC-014", details: "Available quantity is below the 15-unit reorder level." },
    { timestamp: hoursAgo(27), user: "Bhumi Chauhan", initials: "BC", avatar: "blue", action: "stock", actionLabel: "Stock dispatched", module: "Stock", record: "Bluetooth Speaker", reference: "ISS-2026-018", details: "2 units dispatched for a customer order." },
    { timestamp: hoursAgo(34), user: "Nina Shah", initials: "NS", avatar: "green", action: "created", actionLabel: "Customer created", module: "Customers", record: "Willow Creek Retail", reference: "CUS-0012", details: "Customer profile added to the directory." },
    { timestamp: hoursAgo(52), user: "Bhumi Chauhan", initials: "BC", avatar: "blue", action: "archived", actionLabel: "Supplier archived", module: "Suppliers", record: "Metro Packaging", reference: "SUP-0004", details: "Supplier archived; linked purchase history was kept." },
    { timestamp: hoursAgo(75), user: "Arjun Patel", initials: "AP", avatar: "purple", action: "created", actionLabel: "Purchase order created", module: "Purchases", record: "PO-2026-040", reference: "Acme Supply Co.", details: "Purchase order created with 2 product lines, totaling ₹633.00." },
    { timestamp: hoursAgo(120), user: "Bhumi Chauhan", initials: "BC", avatar: "blue", action: "updated", actionLabel: "Category updated", module: "Categories", record: "Office supplies", reference: "CAT-0006", details: "Category description updated." },
    { timestamp: hoursAgo(190), user: "System", initials: "SY", avatar: "grey", action: "status", actionLabel: "Payment recorded", module: "Sales", record: "INV-2026-105", reference: "Willow Creek Retail", details: "Invoice payment status changed from Pending to Paid." },
    { timestamp: hoursAgo(300), user: "Bhumi Chauhan", initials: "BC", avatar: "blue", action: "created", actionLabel: "Product created", module: "Products", record: "Desk Organizer Set", reference: "OFF-019", details: "Product added to the Office supplies category." }
    ];

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return {
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    };
}

function isToday(timestamp) {
    const eventDate = new Date(timestamp);
    const today = new Date();
    return eventDate.getFullYear() === today.getFullYear() &&
        eventDate.getMonth() === today.getMonth() &&
        eventDate.getDate() === today.getDate();
}

function createCell(className) {
    const cell = document.createElement("td");
    if (className) {
        cell.className = className;
    }
    return cell;
}

function renderAuditRows(events) {
    auditRows.replaceChildren();
    events.forEach(function (event) {
        const row = document.createElement("tr");
        const dateCell = createCell();
        const dateCopy = document.createElement("span");
        const timeCopy = document.createElement("span");
        const formattedDate = formatDate(event.timestamp);
        dateCopy.className = "audit-date";
        const dateText = document.createElement("strong");
        dateText.textContent = formattedDate.date;
        timeCopy.textContent = formattedDate.time;
        dateCopy.append(dateText, timeCopy);
        dateCell.appendChild(dateCopy);

        const userCell = createCell();
        const user = document.createElement("span");
        const avatar = document.createElement("i");
        avatar.className = "audit-user-avatar" + (event.avatar === "blue" ? "" : " avatar-" + event.avatar);
        avatar.textContent = event.initials;
        avatar.setAttribute("aria-hidden", "true");
        user.className = "audit-user";
        user.append(avatar, document.createTextNode(event.user));
        userCell.appendChild(user);

        const actionCell = createCell();
        const action = document.createElement("span");
        action.className = "audit-action " + event.action;
        action.textContent = event.actionLabel;
        actionCell.appendChild(action);

        const recordCell = createCell();
        const record = document.createElement("span");
        const recordName = document.createElement("strong");
        const reference = document.createElement("span");
        record.className = "audit-record";
        recordName.textContent = event.record;
        reference.textContent = event.reference;
        record.append(recordName, reference);
        recordCell.appendChild(record);

        const detailsCell = createCell("audit-details");
        detailsCell.textContent = event.details;
        row.append(dateCell, userCell, actionCell, recordCell, detailsCell);
        auditRows.appendChild(row);
    });

    auditEmpty.hidden = events.length > 0;
    auditResults.textContent = "Showing " + events.length + " of " + auditEvents.length + " events";
}

function updateSummary() {
    document.querySelector("#totalEvents").textContent = String(auditEvents.length);
    document.querySelector("#todayEvents").textContent = String(auditEvents.filter(function (event) {
        return isToday(event.timestamp);
    }).length);
    document.querySelector("#stockEvents").textContent = String(auditEvents.filter(function (event) {
        return event.action === "stock";
    }).length);
    document.querySelector("#teamMembers").textContent = String(new Set(auditEvents.map(function (event) {
        return event.user;
    })).size);
}

function matchesDateFilter(event, filter) {
    if (filter === "today") {
        return isToday(event.timestamp);
    }
    if (filter === "all") {
        return true;
    }
    const days = Number(filter);
    return Number.isFinite(days) && Date.now() - new Date(event.timestamp).getTime() <= days * 24 * 60 * 60 * 1000;
}

function getFilteredEvents() {
    const query = auditSearch.value.trim().toLowerCase();
    const module = auditModuleFilter.value;
    const action = auditActionFilter.value;
    const date = auditDateFilter.value;

    return auditEvents.filter(function (event) {
        const searchableText = [
            event.user,
            event.actionLabel,
            event.module,
            event.record,
            event.reference,
            event.details
        ].join(" ").toLowerCase();
        return (!query || searchableText.includes(query)) &&
            (!module || event.module === module) &&
            (!action || event.action === action) &&
            matchesDateFilter(event, date);
    });
}

function applyFilters() {
    renderAuditRows(getFilteredEvents());
}

function showFeedback(message, isError) {
    auditFeedback.textContent = message;
    auditFeedback.classList.add("is-visible");
    auditFeedback.classList.toggle("is-error", Boolean(isError));
}

function escapeCsv(value) {
    let text = String(value);
    if (/^[\s]*[=+\-@]/.test(text)) {
        text = "'" + text;
    }
    return '"' + text.replace(/"/g, '""') + '"';
}

function exportAuditCsv() {
    const events = getFilteredEvents();
    if (events.length === 0) {
        showFeedback("There are no activity rows to export for these filters.", true);
        return;
    }

    const rows = [
        ["Date and time", "User", "Action", "Module", "Record", "Reference", "Details"],
        ...events.map(function (event) {
            return [
                event.timestamp,
                event.user,
                event.actionLabel,
                event.module,
                event.record,
                event.reference,
                event.details
            ];
        })
    ];
    const csv = "\uFEFF" + rows.map(function (row) {
        return row.map(escapeCsv).join(",");
    }).join("\r\n");
    const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "smartstock-audit-history.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 0);
    showFeedback("Exported " + events.length + " filtered activity events to CSV.", false);
}

const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebarToggle");
const sidebarScrim = document.querySelector("#sidebarScrim");
const notificationButton = document.querySelector("#notificationButton");
const notificationPopover = document.querySelector("#notificationPopover");

function setSidebarOpen(isOpen) {
    sidebar.classList.toggle("is-open", isOpen);
    sidebarScrim.classList.toggle("is-open", isOpen);
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

[auditSearch, auditModuleFilter, auditActionFilter, auditDateFilter].forEach(function (control) {
    control.addEventListener(control === auditSearch ? "input" : "change", applyFilters);
});

document.querySelector("#exportAuditButton").addEventListener("click", exportAuditCsv);
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

updateSummary();
applyFilters();
