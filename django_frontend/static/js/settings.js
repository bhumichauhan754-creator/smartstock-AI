"use strict";

const settingsStorageKey = "smartstock.sampleSettings";
const defaultSettings = {
    workspaceName: "Acme Workspace",
    teamName: "Inventory team",
    contactEmail: "inventory@acmewarehouse.example",
    timezone: "Asia/Kolkata",
    notifications: {
        lowStock: true,
        purchases: true,
        sales: true,
        weeklySummary: false
    }
};
const settingsForm = document.querySelector("#settingsForm");
const workspaceNameInput = document.querySelector("#workspaceName");
const teamNameInput = document.querySelector("#teamName");
const contactEmailInput = document.querySelector("#contactEmail");
const timezoneInput = document.querySelector("#workspaceTimezone");
const lowStockInput = document.querySelector("#lowStockNotifications");
const purchasesInput = document.querySelector("#purchaseNotifications");
const salesInput = document.querySelector("#salesNotifications");
const weeklySummaryInput = document.querySelector("#weeklySummary");
const settingsFeedback = document.querySelector("#settingsFeedback");
const settingsStorageWarning = document.querySelector("#settingsStorageWarning");
const settingsSaveNote = document.querySelector("#settingsSaveNote");
const demoMode = settingsForm.dataset.demo !== "false";
let savedSettings = Object.assign({}, defaultSettings, {
    notifications: Object.assign({}, defaultSettings.notifications)
});

function isValidTimezone(timezone) {
    return Array.from(timezoneInput.options).some(function (option) {
        return option.value === timezone;
    });
}

function readSettings() {
    const rawSettings = window.localStorage.getItem(settingsStorageKey);
    if (!rawSettings) {
        settingsSaveNote.textContent = "Demo defaults are not saved yet.";
        return Object.assign({}, defaultSettings, {
            notifications: Object.assign({}, defaultSettings.notifications)
        });
    }

    const parsedSettings = JSON.parse(rawSettings);
    const notifications = parsedSettings && parsedSettings.notifications;
    const validContactEmail = parsedSettings &&
        typeof parsedSettings.contactEmail === "string" &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsedSettings.contactEmail);
    const validSettings = parsedSettings &&
        typeof parsedSettings.workspaceName === "string" &&
        parsedSettings.workspaceName.trim().length > 0 &&
        parsedSettings.workspaceName.length <= 60 &&
        typeof parsedSettings.teamName === "string" &&
        parsedSettings.teamName.trim().length > 0 &&
        parsedSettings.teamName.length <= 60 &&
        validContactEmail &&
        parsedSettings.contactEmail.length <= 120 &&
        typeof parsedSettings.timezone === "string" &&
        isValidTimezone(parsedSettings.timezone) &&
        notifications &&
        typeof notifications.lowStock === "boolean" &&
        typeof notifications.purchases === "boolean" &&
        typeof notifications.sales === "boolean" &&
        typeof notifications.weeklySummary === "boolean";

    if (!validSettings) {
        throw new TypeError("Saved sample workspace settings have an invalid shape.");
    }
    settingsSaveNote.textContent = "Saved preferences loaded from this browser.";
    return parsedSettings;
}

function copySettings(settings) {
    return Object.assign({}, settings, {
        notifications: Object.assign({}, settings.notifications)
    });
}

function getSettingsFormValues() {
    return {
        workspaceName: workspaceNameInput.value.trim(),
        teamName: teamNameInput.value.trim(),
        contactEmail: contactEmailInput.value.trim(),
        timezone: timezoneInput.value,
        notifications: {
            lowStock: lowStockInput.checked,
            purchases: purchasesInput.checked,
            sales: salesInput.checked,
            weeklySummary: weeklySummaryInput.checked
        }
    };
}

function fillSettingsForm(settings) {
    workspaceNameInput.value = settings.workspaceName;
    teamNameInput.value = settings.teamName;
    contactEmailInput.value = settings.contactEmail;
    timezoneInput.value = settings.timezone;
    lowStockInput.checked = settings.notifications.lowStock;
    purchasesInput.checked = settings.notifications.purchases;
    salesInput.checked = settings.notifications.sales;
    weeklySummaryInput.checked = settings.notifications.weeklySummary;
    document.querySelector("#sidebarWorkspaceName").textContent = settings.workspaceName;
    document.querySelector("#sidebarTeamName").textContent = settings.teamName;
}

function showFeedback(message, isError) {
    settingsFeedback.textContent = message;
    settingsFeedback.classList.add("is-visible");
    settingsFeedback.classList.toggle("is-error", Boolean(isError));
}

function clearFeedback() {
    settingsFeedback.textContent = "";
    settingsFeedback.classList.remove("is-visible", "is-error");
}

function persistSettings(settings, successMessage) {
    try {
        window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
    } catch (error) {
        console.error("Could not save sample workspace settings.", error);
        showFeedback("Settings could not be saved in browser storage. Check available storage and try again.", true);
        return false;
    }

    savedSettings = copySettings(settings);
    fillSettingsForm(savedSettings);
    settingsSaveNote.textContent = "Saved just now in this browser.";
    showFeedback(successMessage, false);
    return true;
}

function handleSettingsSubmit(event) {
    event.preventDefault();
    clearFeedback();

    if (!settingsForm.reportValidity()) {
        return;
    }

    const nextSettings = getSettingsFormValues();
    if (!nextSettings.workspaceName || !nextSettings.teamName || !isValidTimezone(nextSettings.timezone)) {
        showFeedback("Complete the required workspace fields and choose a valid time zone.", true);
        return;
    }

    persistSettings(nextSettings, "Workspace settings saved for this browser.");
}

function discardSettings() {
    fillSettingsForm(savedSettings);
    settingsSaveNote.textContent = "Showing your last saved settings.";
    clearFeedback();
}

function restoreDefaultSettings() {
    const defaults = copySettings(defaultSettings);
    persistSettings(defaults, "Default workspace settings restored.");
}

if (demoMode) {
    settingsForm.addEventListener("submit", handleSettingsSubmit);
    document.querySelector("#restoreDefaultsButton").addEventListener("click", restoreDefaultSettings);
}
document.querySelector("#discardSettingsButton").addEventListener("click", function () {
    if (!demoMode) {
        settingsForm.reset();
    }
    discardSettings();
});

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

if (demoMode) {
    try {
        savedSettings = readSettings();
    } catch (error) {
        console.error("Could not load sample workspace settings.", error);
        settingsStorageWarning.textContent = "Saved workspace settings are invalid or unavailable. Review the defaults and save to replace them.";
        settingsStorageWarning.classList.add("is-visible");
    }
} else {
    savedSettings = getSettingsFormValues();
}

fillSettingsForm(savedSettings);
