"use strict";

const loginForm = document.querySelector("#loginForm");
const emailInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector("#passwordToggle");
const formMessage = document.querySelector("#formMessage");
const emailError = document.querySelector("#emailError");
const passwordError = document.querySelector("#passwordError");

const serverError = formMessage.dataset.serverError || "";
if (serverError && !serverError.includes("{{")) {
    formMessage.textContent = serverError;
    formMessage.classList.add("is-visible", "is-error");
}

function setFieldError(input, errorElement, message) {
    errorElement.textContent = message;
    errorElement.classList.toggle("is-visible", Boolean(message));

    if (message) {
        input.setAttribute("aria-invalid", "true");
    } else {
        input.removeAttribute("aria-invalid");
    }
}

function validateLoginForm() {
    let firstInvalidField = null;
    const email = emailInput.value.trim();

    if (!email) {
        setFieldError(emailInput, emailError, "Enter your email address.");
        firstInvalidField = emailInput;
    } else if (!emailInput.validity.valid) {
        setFieldError(emailInput, emailError, "Enter a valid email address.");
        firstInvalidField = emailInput;
    } else {
        setFieldError(emailInput, emailError, "");
    }

    if (!passwordInput.value) {
        setFieldError(passwordInput, passwordError, "Enter your password.");
        firstInvalidField = firstInvalidField || passwordInput;
    } else if (passwordInput.value.length < 8) {
        setFieldError(passwordInput, passwordError, "Use at least 8 characters.");
        firstInvalidField = firstInvalidField || passwordInput;
    } else {
        setFieldError(passwordInput, passwordError, "");
    }

    if (firstInvalidField) {
        firstInvalidField.focus();
        return false;
    }

    return true;
}

passwordToggle.addEventListener("click", function () {
    const showPassword = passwordInput.type === "password";
    passwordInput.type = showPassword ? "text" : "password";
    passwordToggle.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
    passwordToggle.setAttribute("aria-pressed", String(showPassword));
});

emailInput.addEventListener("input", function () {
    if (emailInput.getAttribute("aria-invalid") === "true") {
        setFieldError(emailInput, emailError, "");
    }
});

passwordInput.addEventListener("input", function () {
    if (passwordInput.getAttribute("aria-invalid") === "true") {
        setFieldError(passwordInput, passwordError, "");
    }
});

loginForm.addEventListener("submit", function (event) {
    formMessage.classList.remove("is-visible");
    formMessage.textContent = "";

    if (!validateLoginForm()) {
        event.preventDefault();
        return;
    }

    if (loginForm.dataset.demo !== "false") {
        event.preventDefault();
        formMessage.textContent = "Form looks good. Connect this page to Django authentication to sign in.";
        formMessage.classList.remove("is-error");
        formMessage.classList.add("is-visible");
    }
});
