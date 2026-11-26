"use strict";

const sampleProductStorageKey = "smartstock.sampleProducts";
const maxImageSize = 1024 * 1024;
const editForm = document.querySelector("#editProductForm");
const productNameInput = document.querySelector("#productName");
const skuInput = document.querySelector("#productSku");
const categoryInput = document.querySelector("#productCategory");
const unitInput = document.querySelector("#productUnit");
const descriptionInput = document.querySelector("#productDescription");
const purchasePriceInput = document.querySelector("#purchasePrice");
const sellingPriceInput = document.querySelector("#sellingPrice");
const quantityInput = document.querySelector("#availableQuantity");
const minimumStockInput = document.querySelector("#minimumStock");
const productImageInput = document.querySelector("#productImage");
const imageDropArea = document.querySelector("#imageDropArea");
const imagePreviewPhoto = document.querySelector("#imagePreviewPhoto");
const imagePreviewIcon = document.querySelector("#imagePreviewIcon");
const imageError = document.querySelector("#imageError");
const clearImageInput = document.querySelector("#clearProductImage");
const formMessage = document.querySelector("#formMessage");
const editLoadError = document.querySelector("#editLoadError");
const saveChangesButton = document.querySelector("#saveChangesButton");
const productNameError = document.querySelector("#productNameError");
const skuError = document.querySelector("#skuError");

const seededProducts = {
    "1": { name: "Wireless Headphones", sku: "ELEC-001", category: "Electronics", purchasePrice: 42, sellingPrice: 79, quantity: 86, minimumStock: 20 },
    "2": { name: "USB-C Hub", sku: "ACC-014", category: "Accessories", purchasePrice: 18.5, sellingPrice: 34.99, quantity: 8, minimumStock: 15 },
    "3": { name: "Ergonomic Office Chair", sku: "FURN-008", category: "Furniture", purchasePrice: 118, sellingPrice: 219, quantity: 24, minimumStock: 10 },
    "4": { name: "Wireless Mouse", sku: "ACC-023", category: "Accessories", purchasePrice: 12, sellingPrice: 24.99, quantity: 142, minimumStock: 30 },
    "5": { name: "Mechanical Keyboard", sku: "ELEC-032", category: "Electronics", purchasePrice: 56, sellingPrice: 99, quantity: 6, minimumStock: 12 },
    "6": { name: "Desk Organizer Set", sku: "OFF-019", category: "Office supplies", purchasePrice: 8.5, sellingPrice: 17.99, quantity: 54, minimumStock: 15 },
    "7": { name: "Bluetooth Speaker", sku: "ELEC-041", category: "Electronics", purchasePrice: 29, sellingPrice: 54, quantity: 0, minimumStock: 10 },
    "8": { name: "Notebook Multipack", sku: "OFF-027", category: "Office supplies", purchasePrice: 5, sellingPrice: 11.5, quantity: 210, minimumStock: 40 }
};

let productId = "";
let currentProduct = null;
let selectedImageData = "";

function showMessage(message, isError) {
    formMessage.textContent = message;
    formMessage.classList.add("is-visible");
    formMessage.classList.toggle("is-error", Boolean(isError));
}

function showLoadError(message, error) {
    if (error) {
        console.error(message, error);
    }
    editLoadError.textContent = message;
    editLoadError.hidden = false;
    editForm.querySelectorAll("input, select, textarea, button[type='submit']").forEach(function (control) {
        control.disabled = true;
    });
}

function setImagePreviewPlaceholderHidden(isHidden) {
    if (isHidden) {
        imagePreviewIcon.setAttribute("hidden", "");
    } else {
        imagePreviewIcon.removeAttribute("hidden");
    }
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

function getProductIdFromUrl() {
    const queryId = new URLSearchParams(window.location.search).get("id");
    if (queryId) {
        return queryId;
    }

    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const editIndex = pathParts.lastIndexOf("edit");
    if (editIndex > 0) {
        return decodeURIComponent(pathParts[editIndex - 1]);
    }

    return "1";
}

function readSavedProducts() {
    const rawProducts = window.localStorage.getItem(sampleProductStorageKey);
    if (!rawProducts) {
        return [];
    }

    const savedProducts = JSON.parse(rawProducts);
    if (!Array.isArray(savedProducts)) {
        throw new TypeError("Saved sample products must be stored as a list.");
    }

    return savedProducts;
}

function findCurrentProduct() {
    const savedProducts = readSavedProducts();
    const savedProduct = savedProducts.find(function (product) {
        return product && product.id === productId;
    });
    if (savedProduct) {
        return savedProduct;
    }

    const seededProduct = seededProducts[productId];
    if (!seededProduct) {
        return null;
    }

    return Object.assign({ id: productId, unit: "Units", imageData: "", description: "" }, seededProduct);
}

function fillForm(product) {
    productNameInput.value = product.name;
    skuInput.value = product.sku;
    categoryInput.value = product.category;
    unitInput.value = product.unit || "Units";
    descriptionInput.value = product.description || "";
    purchasePriceInput.value = String(product.purchasePrice);
    sellingPriceInput.value = String(product.sellingPrice);
    quantityInput.value = String(product.quantity);
    minimumStockInput.value = String(product.minimumStock);
    editPageSubtitle.textContent = product.name + " · " + product.sku;
    editForm.action = "/products/" + encodeURIComponent(productId) + "/edit/";

    if (typeof product.imageData === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(product.imageData)) {
        selectedImageData = product.imageData;
        imagePreviewPhoto.src = selectedImageData;
        imagePreviewPhoto.hidden = false;
        setImagePreviewPlaceholderHidden(true);
    }
}

function isDuplicateSku(normalizedSku) {
    const isSeedDuplicate = Object.entries(seededProducts).some(function ([id, product]) {
        return id !== productId && product.sku.toUpperCase() === normalizedSku;
    });
    if (isSeedDuplicate) {
        return true;
    }

    let savedProducts;
    try {
        savedProducts = readSavedProducts();
    } catch (error) {
        console.error("Could not verify the sample product SKU.", error);
        showMessage("Saved sample data could not be read. Clear the SmartStock sample data and try again.", true);
        return null;
    }

    return savedProducts.some(function (product) {
        return product && product.id !== productId &&
            typeof product.sku === "string" &&
            product.sku.toUpperCase() === normalizedSku;
    });
}

function validateEditForm() {
    let firstInvalidInput = null;
    const name = productNameInput.value.trim();
    const normalizedSku = skuInput.value.trim().toUpperCase();

    if (!name) {
        setInputError(productNameInput, productNameError, "Enter a product name.");
        firstInvalidInput = productNameInput;
    } else {
        setInputError(productNameInput, productNameError, "");
    }

    if (!normalizedSku) {
        setInputError(skuInput, skuError, "Enter a SKU.");
        firstInvalidInput = firstInvalidInput || skuInput;
    } else {
        const duplicateSku = isDuplicateSku(normalizedSku);
        if (duplicateSku === null) {
            return false;
        }
        if (duplicateSku) {
            setInputError(skuInput, skuError, "That SKU is already used by another product.");
            firstInvalidInput = firstInvalidInput || skuInput;
        } else {
            setInputError(skuInput, skuError, "");
        }
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

    if (!editForm.checkValidity()) {
        editForm.reportValidity();
        return false;
    }

    return true;
}

function previewImage(file) {
    imageError.textContent = "";
    imageError.classList.remove("is-visible");

    if (!file) {
        return;
    }
    clearImageInput.value = "false";

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        imageError.textContent = "Choose a PNG, JPG, or WebP image.";
        imageError.classList.add("is-visible");
        productImageInput.value = "";
        return;
    }

    if (file.size > maxImageSize) {
        imageError.textContent = "Choose an image smaller than 1 MB.";
        imageError.classList.add("is-visible");
        productImageInput.value = "";
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

function setProductImage(imageData) {
    selectedImageData = imageData || "";
    if (selectedImageData) {
        imagePreviewPhoto.src = selectedImageData;
        imagePreviewPhoto.hidden = false;
        setImagePreviewPlaceholderHidden(true);
    } else {
        imagePreviewPhoto.removeAttribute("src");
        imagePreviewPhoto.hidden = true;
        setImagePreviewPlaceholderHidden(false);
    }
}

function saveEditedProduct() {
    let savedProducts = readSavedProducts();
    const updatedProduct = {
        id: productId,
        name: productNameInput.value.trim(),
        sku: skuInput.value.trim().toUpperCase(),
        category: categoryInput.value,
        purchasePrice: Number(purchasePriceInput.value),
        sellingPrice: Number(sellingPriceInput.value),
        quantity: Number(quantityInput.value),
        minimumStock: Number(minimumStockInput.value),
        unit: unitInput.value,
        description: descriptionInput.value.trim(),
        imageData: selectedImageData
    };
    const existingIndex = savedProducts.findIndex(function (product) {
        return product && product.id === productId;
    });

    if (existingIndex === -1) {
        savedProducts = savedProducts.concat(updatedProduct);
    } else {
        savedProducts[existingIndex] = updatedProduct;
    }

    window.localStorage.setItem(sampleProductStorageKey, JSON.stringify(savedProducts));
    currentProduct = updatedProduct;
}

productId = getProductIdFromUrl();
const editPageSubtitle = document.querySelector("#editPageSubtitle");
if (editForm.dataset.demo !== "false") {
    try {
        currentProduct = findCurrentProduct();
    } catch (error) {
        showLoadError("Saved sample product data could not be read. Clear the SmartStock sample data from this browser’s storage and refresh.", error);
    }

    if (!currentProduct && editLoadError.hidden) {
        showLoadError("This product could not be loaded. Return to Product Management and choose an existing item.");
    } else if (currentProduct) {
        fillForm(currentProduct);
    }
} else {
    const categoryOptions = document.querySelector("#serverProductCategories");
    const categoryPlaceholder = categoryInput.options[0].cloneNode(true);
    categoryInput.replaceChildren(categoryPlaceholder);
    categoryInput.appendChild(categoryOptions.content.cloneNode(true));
    categoryInput.value = categoryInput.dataset.initialValue || "";
    purchasePriceInput.value = purchasePriceInput.dataset.initialValue || "";
    sellingPriceInput.value = sellingPriceInput.dataset.initialValue || "";
    quantityInput.value = quantityInput.dataset.initialValue || "";
    minimumStockInput.value = minimumStockInput.dataset.initialValue || "";
    if (imagePreviewPhoto.dataset.imageUrl) {
        setProductImage(imagePreviewPhoto.dataset.imageUrl);
    }
}

editForm.addEventListener("submit", function (event) {
    if (editForm.dataset.demo === "false") {
        if (!editForm.checkValidity()) {
            event.preventDefault();
            editForm.reportValidity();
        }
        return;
    }

    event.preventDefault();
    formMessage.classList.remove("is-visible");

    if (!validateEditForm()) {
        return;
    }

    try {
        saveEditedProduct();
    } catch (error) {
        showMessage("The changes could not be saved in browser storage. Check available storage and try again.", true);
        console.error("Could not save edited sample product.", error);
        return;
    }

    editPageSubtitle.textContent = currentProduct.name + " · " + currentProduct.sku;
    showMessage("Changes saved to this browser’s sample catalog. Open Product Management to review them.", false);
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

document.querySelector("#removeProductImage").addEventListener("click", function () {
    productImageInput.value = "";
    clearImageInput.value = "true";
    imageError.textContent = "";
    imageError.classList.remove("is-visible");
    setProductImage("");
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
