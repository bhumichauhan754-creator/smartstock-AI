"use strict";

const registrationForm = document.querySelector("#registrationForm");
const fullNameInput = document.querySelector("#fullName");
const workspaceNameInput = document.querySelector("#workspaceName");
const registrationEmailInput = document.querySelector("#registrationEmail");
const registrationPasswordInput = document.querySelector("#registrationPassword");
const confirmPasswordInput = document.querySelector("#confirmPassword");
const registrationMessage = document.querySelector("#registrationMessage");
const registrationFields = [
    { input: fullNameInput, error: document.querySelector("#fullNameError") },
    { input: workspaceNameInput, error: document.querySelector("#workspaceNameError") },
    { input: registrationEmailInput, error: document.querySelector("#registrationEmailError") },
    { input: registrationPasswordInput, error: document.querySelector("#registrationPasswordError") },
    { input: confirmPasswordInput, error: document.querySelector("#confirmPasswordError") }
];
let hasSubmitted = false;

function setFieldError(input, errorElement, message) {
    errorElement.textContent = message;
    errorElement.classList.toggle("is-visible", Boolean(message));
    if (message) {
        input.setAttribute("aria-invalid", "true");
    } else {
        input.removeAttribute("aria-invalid");
    }
}

function validateRegistrationForm(focusInvalidField) {
    let firstInvalidField = null;
    const fullName = fullNameInput.value.trim();
    const workspaceName = workspaceNameInput.value.trim();
    const email = registrationEmailInput.value.trim();
    const password = registrationPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!fullName) {
        setFieldError(fullNameInput, registrationFields[0].error, "Enter your full name.");
        firstInvalidField = fullNameInput;
    } else {
        setFieldError(fullNameInput, registrationFields[0].error, "");
    }

    if (!workspaceName) {
        setFieldError(workspaceNameInput, registrationFields[1].error, "Enter a workspace name.");
        firstInvalidField = firstInvalidField || workspaceNameInput;
    } else {
        setFieldError(workspaceNameInput, registrationFields[1].error, "");
    }

    if (!email) {
        setFieldError(registrationEmailInput, registrationFields[2].error, "Enter your email address.");
        firstInvalidField = firstInvalidField || registrationEmailInput;
    } else if (!registrationEmailInput.validity.valid) {
        setFieldError(registrationEmailInput, registrationFields[2].error, "Enter a valid email address.");
        firstInvalidField = firstInvalidField || registrationEmailInput;
    } else {
        setFieldError(registrationEmailInput, registrationFields[2].error, "");
    }

    if (!password) {
        setFieldError(registrationPasswordInput, registrationFields[3].error, "Create a password.");
        firstInvalidField = firstInvalidField || registrationPasswordInput;
    } else if (password.length < 8) {
        setFieldError(registrationPasswordInput, registrationFields[3].error, "Use at least 8 characters.");
        firstInvalidField = firstInvalidField || registrationPasswordInput;
    } else {
        setFieldError(registrationPasswordInput, registrationFields[3].error, "");
    }

    if (!confirmPassword) {
        setFieldError(confirmPasswordInput, registrationFields[4].error, "Confirm your password.");
        firstInvalidField = firstInvalidField || confirmPasswordInput;
    } else if (password !== confirmPassword) {
        setFieldError(confirmPasswordInput, registrationFields[4].error, "Passwords do not match.");
        firstInvalidField = firstInvalidField || confirmPasswordInput;
    } else {
        setFieldError(confirmPasswordInput, registrationFields[4].error, "");
    }

    if (firstInvalidField && focusInvalidField) {
        firstInvalidField.focus();
        return false;
    }
    return !firstInvalidField;
}

function connectPasswordToggle(buttonId, input) {
    const button = document.querySelector(buttonId);
    button.addEventListener("click", function () {
        const showPassword = input.type === "password";
        input.type = showPassword ? "text" : "password";
        button.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
        button.setAttribute("aria-pressed", String(showPassword));
    });
}

registrationFields.forEach(function (field) {
    field.input.addEventListener("input", function () {
        if (hasSubmitted) {
            validateRegistrationForm(false);
        }
    });
});

registrationForm.addEventListener("submit", function (event) {
    hasSubmitted = true;
    registrationMessage.classList.remove("is-visible");
    registrationMessage.classList.remove("is-error");
    registrationMessage.textContent = "";

    if (!validateRegistrationForm(true)) {
        event.preventDefault();
        return;
    }

    if (registrationForm.dataset.demo !== "false") {
        event.preventDefault();
        registrationMessage.textContent = "Your details are valid. Connect this form to Django authentication to create an account.";
        registrationMessage.classList.add("is-visible");
    }
});

connectPasswordToggle("#registrationPasswordToggle", registrationPasswordInput);
connectPasswordToggle("#confirmPasswordToggle", confirmPasswordInput);

const serverError = registrationMessage.dataset.serverError || "";
if (serverError && !serverError.includes("{{")) {
    registrationMessage.textContent = serverError;
    registrationMessage.classList.add("is-visible", "is-error");
}
