"use strict";

const sampleProductStorageKey = "smartstock.sampleProducts";
const maxImageSize = 1024 * 1024;
const productForm = document.querySelector("#productForm");
const productNameInput = document.querySelector("#productName");
const skuInput = document.querySelector("#productSku");
const categoryInput = document.querySelector("#productCategory");
const productImageInput = document.querySelector("#productImage");
const imageDropArea = document.querySelector("#imageDropArea");
const imagePreviewPhoto = document.querySelector("#imagePreviewPhoto");
const imagePreviewIcon = document.querySelector("#imagePreviewIcon");
const formMessage = document.querySelector("#formMessage");
const productNameError = document.querySelector("#productNameError");
const skuError = document.querySelector("#skuError");
const imageError = document.querySelector("#imageError");

const seededSkus = new Set([
    "ELEC-001",
    "ACC-014",
    "FURN-008",
    "ACC-023",
    "ELEC-032",
    "OFF-019",
    "ELEC-041",
    "OFF-027"
]);

let selectedImageData = "";

if (productForm.dataset.demo === "false") {
    const categoryOptions = document.querySelector("#serverProductCategories");
    const categoryPlaceholder = categoryInput.options[0].cloneNode(true);
    categoryInput.replaceChildren(categoryPlaceholder);
    categoryInput.appendChild(categoryOptions.content.cloneNode(true));
}

function setImagePreviewPlaceholderHidden(isHidden) {
    if (isHidden) {
        imagePreviewIcon.setAttribute("hidden", "");
    } else {
        imagePreviewIcon.removeAttribute("hidden");
    }
}

function showMessage(message, isError) {
    formMessage.textContent = message;
    formMessage.classList.add("is-visible");
    formMessage.classList.toggle("is-error", Boolean(isError));
}

function setInputError(input, errorElement, message) {
    errorElement.textContent = message;
    errorElement.classList.toggle("is-visible", Boolean(message));

    if (message) {
        input.setAttribute("aria-invalid", "true");
    } else {
        input.removeAttribute("aria-invalid");
    }
}

function readSavedProducts() {
    const rawProducts = window.localStorage.getItem(sampleProductStorageKey);
    if (!rawProducts) {
        return [];
    }

    const parsedProducts = JSON.parse(rawProducts);
    if (!Array.isArray(parsedProducts)) {
        throw new TypeError("Saved sample products must be stored as a list.");
    }
    return parsedProducts;
}

function validateProductForm() {
    let firstInvalidInput = null;
    const sku = skuInput.value.trim().toUpperCase();
    const name = productNameInput.value.trim();

    if (!name) {
        setInputError(productNameInput, productNameError, "Enter a product name.");
        firstInvalidInput = productNameInput;
    } else {
        setInputError(productNameInput, productNameError, "");
    }

    if (!sku) {
        setInputError(skuInput, skuError, "Enter a SKU.");
        firstInvalidInput = firstInvalidInput || skuInput;
    } else if (seededSkus.has(sku)) {
        setInputError(skuInput, skuError, "That SKU is already used by a sample product.");
        firstInvalidInput = firstInvalidInput || skuInput;
    } else {
        setInputError(skuInput, skuError, "");
    }

    if (firstInvalidInput) {
        firstInvalidInput.focus();
        return false;
    }

    if (imageError.classList.contains("is-visible")) {
        showMessage("Choose a supported product image or remove the invalid image selection.", true);
        productImageInput.focus();
        return false;
    }

    if (!productForm.checkValidity()) {
        productForm.reportValidity();
        return false;
    }

    return true;
}

function previewImage(file) {
    imageError.textContent = "";
    imageError.classList.remove("is-visible");

    if (!file) {
        selectedImageData = "";
        imagePreviewPhoto.removeAttribute("src");
        imagePreviewPhoto.hidden = true;
        setImagePreviewPlaceholderHidden(false);
        return;
    }

    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
        imageError.textContent = "Choose a PNG, JPG, or WebP image.";
        imageError.classList.add("is-visible");
        productImageInput.value = "";
        selectedImageData = "";
        imagePreviewPhoto.hidden = true;
        setImagePreviewPlaceholderHidden(false);
        return;
    }

    if (file.size > maxImageSize) {
        imageError.textContent = "Choose an image smaller than 1 MB.";
        imageError.classList.add("is-visible");
        productImageInput.value = "";
        selectedImageData = "";
        imagePreviewPhoto.hidden = true;
        setImagePreviewPlaceholderHidden(false);
        return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", function () {
        if (typeof reader.result !== "string") {
            showMessage("The selected image could not be previewed. Try another image.", true);
            return;
        }

        selectedImageData = reader.result;
        imagePreviewPhoto.src = selectedImageData;
        imagePreviewPhoto.hidden = false;
        setImagePreviewPlaceholderHidden(true);
    });
    reader.addEventListener("error", function () {
        showMessage("The selected image could not be read. Try another image.", true);
    });
    reader.readAsDataURL(file);
}

function buildSampleProduct() {
    return {
        id: "sample-" + Date.now().toString(36),
        name: productNameInput.value.trim(),
        sku: skuInput.value.trim().toUpperCase(),
        category: document.querySelector("#productCategory").value,
        purchasePrice: Number(document.querySelector("#purchasePrice").value),
        sellingPrice: Number(document.querySelector("#sellingPrice").value),
        quantity: Number(document.querySelector("#availableQuantity").value),
        minimumStock: Number(document.querySelector("#minimumStock").value),
        unit: document.querySelector("#productUnit").value,
        imageData: selectedImageData
    };
}

productForm.addEventListener("submit", function (event) {
    if (productForm.dataset.demo === "false") {
        if (!productForm.checkValidity()) {
            event.preventDefault();
            productForm.reportValidity();
        }
        return;
    }

    event.preventDefault();
    formMessage.classList.remove("is-visible");

    if (!validateProductForm()) {
        return;
    }

    let savedProducts;
    try {
        savedProducts = readSavedProducts();
    } catch (error) {
        console.error("Could not read saved sample products.", error);
        showMessage("Saved sample data could not be read. Clear the SmartStock sample data in browser storage and try again.", true);
        return;
    }

    const normalizedSku = skuInput.value.trim().toUpperCase();
    const duplicateSku = savedProducts.some(function (product) {
        return product && typeof product.sku === "string" && product.sku.toUpperCase() === normalizedSku;
    });

    if (duplicateSku) {
        setInputError(skuInput, skuError, "That SKU is already used by a sample product.");
        skuInput.focus();
        return;
    }

    const updatedProducts = savedProducts.concat(buildSampleProduct());
    try {
        window.localStorage.setItem(sampleProductStorageKey, JSON.stringify(updatedProducts));
    } catch (error) {
        console.error("Could not save the sample product.", error);
        showMessage("The product could not be saved in browser storage. Check available storage and try again.", true);
        return;
    }

    showMessage("Product saved to this browser’s sample catalog. Open Product Management to see it.", false);
    productForm.reset();
    selectedImageData = "";
    imagePreviewPhoto.removeAttribute("src");
    imagePreviewPhoto.hidden = true;
    setImagePreviewPlaceholderHidden(false);
});

const serverError = formMessage.dataset.serverError || "";
if (serverError && !serverError.includes("{{")) {
    showMessage(serverError, true);
}

productNameInput.addEventListener("input", function () {
    setInputError(productNameInput, productNameError, "");
});

skuInput.addEventListener("input", function () {
    setInputError(skuInput, skuError, "");
});

productImageInput.addEventListener("change", function () {
    previewImage(productImageInput.files[0]);
});

imageDropArea.addEventListener("dragover", function (event) {
    event.preventDefault();
    imageDropArea.classList.add("is-dragging");
});

imageDropArea.addEventListener("dragleave", function (event) {
    if (!imageDropArea.contains(event.relatedTarget)) {
        imageDropArea.classList.remove("is-dragging");
    }
});

imageDropArea.addEventListener("drop", function (event) {
    event.preventDefault();
    imageDropArea.classList.remove("is-dragging");

    const file = event.dataTransfer.files[0];
    if (!file) {
        return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    productImageInput.files = transfer.files;
    previewImage(file);
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
