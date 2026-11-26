"use strict";

const profileStorageKey = "smartstock.sampleProfile";
const defaultProfile = {
    fullName: "Bhumi Chauhan",
    email: "bhumi.chauhan@example.com",
    phone: "+91 98765 43210",
    department: "Inventory Operations",
    timezone: "Asia/Kolkata",
    bio: "Managing inventory operations and keeping our stock data organized."
};
const profileForm = document.querySelector("#profileForm");
const profileFullName = document.querySelector("#profileFullName");
const profileEmail = document.querySelector("#profileEmail");
const profilePhone = document.querySelector("#profilePhone");
const profileDepartment = document.querySelector("#profileDepartment");
const profileTimezone = document.querySelector("#profileTimezone");
const profileBio = document.querySelector("#profileBio");
const profileFeedback = document.querySelector("#profileFeedback");
const profileStorageWarning = document.querySelector("#profileStorageWarning");
const profileBioCount = document.querySelector("#profileBioCount");
const profileRole = document.querySelector("#profileRole");
const demoMode = profileForm.dataset.demo !== "false";
let savedProfile = Object.assign({}, defaultProfile);

function readProfile() {
    const rawProfile = window.localStorage.getItem(profileStorageKey);
    if (!rawProfile) {
        return Object.assign({}, defaultProfile);
    }

    const parsedProfile = JSON.parse(rawProfile);
    const validProfile = parsedProfile &&
        typeof parsedProfile.fullName === "string" &&
        parsedProfile.fullName.trim().length > 0 &&
        parsedProfile.fullName.length <= 80 &&
        typeof parsedProfile.email === "string" &&
        parsedProfile.email.length <= 120 &&
        typeof parsedProfile.phone === "string" &&
        parsedProfile.phone.length <= 30 &&
        typeof parsedProfile.department === "string" &&
        parsedProfile.department.length <= 80 &&
        typeof parsedProfile.timezone === "string" &&
        Array.from(profileTimezone.options).some(function (option) {
            return option.value === parsedProfile.timezone;
        }) &&
        typeof parsedProfile.bio === "string";
    const validBioLength = validProfile && parsedProfile.bio.length <= 240;

    if (!validProfile || !validBioLength) {
        throw new TypeError("Saved sample profile has an invalid shape.");
    }
    return parsedProfile;
}

function getInitials(fullName) {
    return fullName.trim().split(/\s+/).slice(0, 2).map(function (part) {
        return part.charAt(0).toUpperCase();
    }).join("");
}

function updateProfileSummary(profile) {
    const initials = getInitials(profile.fullName);
    document.querySelector("#profileAvatar").textContent = initials;
    document.querySelector("#topbarAvatar").textContent = initials;
    document.querySelector("#sidebarAvatar").textContent = initials;
    document.querySelector("#sidebarUserName").textContent = profile.fullName;
    document.querySelector("#profileNameDisplay").textContent = profile.fullName;
    document.querySelector("#profileDepartmentDisplay").textContent = profile.department || "No department";
}

function updateBioCount() {
    profileBioCount.textContent = profileBio.value.length + " / 240 characters";
}

function fillProfileForm(profile) {
    profileFullName.value = profile.fullName;
    profileEmail.value = profile.email;
    profilePhone.value = profile.phone;
    profileDepartment.value = profile.department;
    profileTimezone.value = profile.timezone;
    profileBio.value = profile.bio;
    updateBioCount();
    updateProfileSummary(profile);
}

function showFeedback(message, isError) {
    profileFeedback.textContent = message;
    profileFeedback.classList.add("is-visible");
    profileFeedback.classList.toggle("is-error", Boolean(isError));
}

function clearFeedback() {
    profileFeedback.textContent = "";
    profileFeedback.classList.remove("is-visible", "is-error");
}

function getProfileFormValues() {
    return {
        fullName: profileFullName.value.trim(),
        email: profileEmail.value.trim(),
        phone: profilePhone.value.trim(),
        department: profileDepartment.value.trim(),
        timezone: profileTimezone.value,
        bio: profileBio.value.trim()
    };
}

function handleProfileSubmit(event) {
    event.preventDefault();
    clearFeedback();

    const nextProfile = getProfileFormValues();
    if (!profileForm.reportValidity()) {
        return;
    }

    if (!nextProfile.fullName) {
        profileFullName.setCustomValidity("Enter your full name.");
        profileFullName.reportValidity();
        profileFullName.setCustomValidity("");
        return;
    }

    if (!Array.from(profileTimezone.options).some(function (option) {
        return option.value === nextProfile.timezone;
    })) {
        showFeedback("Choose a valid time zone before saving.", true);
        return;
    }

    try {
        window.localStorage.setItem(profileStorageKey, JSON.stringify(nextProfile));
    } catch (error) {
        console.error("Could not save the sample user profile.", error);
        showFeedback("Your profile could not be saved in browser storage. Check available storage and try again.", true);
        return;
    }

    savedProfile = nextProfile;
    fillProfileForm(savedProfile);
    showFeedback("Profile changes saved for this browser.", false);
}

function resetProfileForm() {
    clearFeedback();
    fillProfileForm(savedProfile);
}

if (demoMode) {
    profileForm.addEventListener("submit", handleProfileSubmit);
} else {
    savedProfile = {
        fullName: profileFullName.value,
        email: profileEmail.value,
        phone: profilePhone.value,
        department: profileDepartment.value,
        timezone: profileTimezone.value,
        bio: profileBio.value
    };
}
document.querySelector("#resetProfileButton").addEventListener("click", function () {
    if (!demoMode) {
        profileForm.reset();
    }
    resetProfileForm();
});
profileBio.addEventListener("input", updateBioCount);

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
        savedProfile = readProfile();
    } catch (error) {
        console.error("Could not load the sample user profile.", error);
        profileStorageWarning.textContent = "Saved profile data is invalid or unavailable. Your changes will not be saved until the browser data is corrected.";
        profileStorageWarning.classList.add("is-visible");
        profileForm.querySelector('button[type="submit"]').disabled = true;
    }
}

fillProfileForm(savedProfile);
