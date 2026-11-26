"use strict";

const categoryStorageKey = "smartstock.sampleCategories";
const isDemo = document.querySelector("#categoryRows").dataset.demo !== "false";
const seededCategories = [
    { id: "cat-electronics", name: "Electronics", description: "Computers, audio, and electronic devices.", productCount: 62, isActive: true, createdAt: "Oct 12, 2026" },
    { id: "cat-accessories", name: "Accessories", description: "Useful add-ons and everyday tech essentials.", productCount: 48, isActive: true, createdAt: "Oct 14, 2026" },
    { id: "cat-office", name: "Office supplies", description: "Stationery and tools for productive workspaces.", productCount: 31, isActive: true, createdAt: "Oct 18, 2026" },
    { id: "cat-furniture", name: "Furniture", description: "Furniture and fixtures for home and office.", productCount: 16, isActive: true, createdAt: "Oct 20, 2026" },
    { id: "cat-packaging", name: "Packaging", description: "Shipping materials and product packaging.", productCount: 0, isActive: true, createdAt: "Oct 26, 2026" },
    { id: "cat-seasonal", name: "Seasonal", description: "Limited-time and seasonal inventory.", productCount: 0, isActive: false, createdAt: "Nov 2, 2026" }
];
const categoryColorClasses = ["color-blue", "color-purple", "color-green", "color-orange", "color-teal", "color-rose"];
const categoryRows = document.querySelector("#categoryRows");
const categorySearch = document.querySelector("#categorySearch");
const categoryStatusFilter = document.querySelector("#categoryStatusFilter");
const emptyCategories = document.querySelector("#emptyCategories");
const categoryResults = document.querySelector("#categoryResults");
const categoryStorageWarning = document.querySelector("#categoryStorageWarning");
const categoryDialog = document.querySelector("#categoryDialog");
const categoryForm = document.querySelector("#categoryForm");
const categoryNameInput = document.querySelector("#categoryName");
const categoryDescriptionInput = document.querySelector("#categoryDescription");
const categoryActiveInput = document.querySelector("#categoryActive");
const categoryNameError = document.querySelector("#categoryNameError");
const dialogMessage = document.querySelector("#dialogMessage");
const dialogTitle = document.querySelector("#dialogTitle");
const dialogSubtitle = document.querySelector("#dialogSubtitle");
const saveCategoryButton = document.querySelector("#saveCategoryButton");
const totalCategories = document.querySelector("#totalCategories");
const activeCategories = document.querySelector("#activeCategories");
const archivedCategories = document.querySelector("#archivedCategories");
const categorizedProducts = document.querySelector("#categorizedProducts");
const addCategoryButton = document.querySelector("#addCategoryButton");
const categoryDataLabel = document.querySelector("#categoryDataLabel");
let categories = [];
let editingCategoryId = null;
let storageReady = true;

function readSavedCategories() {
    const rawCategories = window.localStorage.getItem(categoryStorageKey);
    if (!rawCategories) {
        return [];
    }

    const savedCategories = JSON.parse(rawCategories);
    if (!Array.isArray(savedCategories)) {
        throw new TypeError("Saved sample categories must be stored as a list.");
    }

    savedCategories.forEach(function (category) {
        const validCategory = category &&
            typeof category.id === "string" &&
            typeof category.name === "string" &&
            typeof category.description === "string" &&
            Number.isInteger(category.productCount) &&
            typeof category.isActive === "boolean" &&
            typeof category.createdAt === "string" &&
            typeof category.isDeleted === "boolean";

        if (!validCategory) {
            throw new TypeError("A saved sample category has an invalid shape.");
        }
    });

    return savedCategories;
}

function mergeCategories(savedCategories) {
    const merged = seededCategories.map(function (category) {
        return Object.assign({}, category);
    });

    savedCategories.forEach(function (savedCategory) {
        const existingIndex = merged.findIndex(function (category) {
            return category.id === savedCategory.id;
        });

        if (savedCategory.isDeleted) {
            if (existingIndex !== -1) {
                merged.splice(existingIndex, 1);
            }
            return;
        }

        if (existingIndex === -1) {
            merged.push(savedCategory);
        } else {
            merged[existingIndex] = savedCategory;
        }
    });

    return merged;
}

function createIcon(pathData, strokeWidth) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    path.setAttribute("d", pathData);
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", strokeWidth);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.appendChild(path);
    return svg;
}

function createCategoryRow(category, index) {
    const row = document.createElement("tr");
    row.dataset.name = category.name.toLowerCase();
    row.dataset.description = category.description.toLowerCase();
    row.dataset.status = category.isActive ? "active" : "archived";
    row.dataset.categoryId = category.id;

    const identity = document.createElement("div");
    identity.className = "category-name-cell";
    const mark = document.createElement("span");
    mark.className = "category-color-mark " + categoryColorClasses[index % categoryColorClasses.length];
    mark.appendChild(createIcon("M3.5 3.5h5.2v5.2H3.5zM11.3 3.5h5.2v5.2h-5.2zM3.5 11.3h5.2v5.2H3.5zM11.3 11.3h5.2v5.2h-5.2z", "1.3"));
    const copy = document.createElement("span");
    copy.className = "category-name-copy";
    const name = document.createElement("strong");
    const code = document.createElement("small");
    name.textContent = category.name;
    code.textContent = category.id.toUpperCase();
    copy.append(name, code);
    identity.append(mark, copy);
    row.appendChild(createCell(identity));

    const description = document.createElement("span");
    description.className = "category-description";
    description.textContent = category.description || "No description provided.";
    row.appendChild(createCell(description));

    const productCount = document.createElement("span");
    productCount.className = "category-product-count";
    productCount.append(
        document.createTextNode(String(category.productCount)),
        document.createElement("small")
    );
    productCount.lastChild.textContent = category.productCount === 1 ? "product" : "products";
    row.appendChild(createCell(productCount));
    row.appendChild(createCell(category.createdAt, "category-date"));

    const status = document.createElement("span");
    status.className = "category-status " + (category.isActive ? "active" : "archived");
    const statusDot = document.createElement("i");
    status.append(statusDot, document.createTextNode(category.isActive ? "Active" : "Archived"));
    row.appendChild(createCell(status));

    const actions = document.createElement("div");
    actions.className = "category-actions";
    const editButton = document.createElement("button");
    editButton.className = "category-action";
    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.setAttribute("aria-label", "Edit " + category.name);
    editButton.appendChild(createIcon("m12.8 4.2 3 3M4 16l3.7-.8L16 6.9a1.8 1.8 0 0 0-2.6-2.6L5 12.7 4 16Z", "1.5"));

    const deleteButton = document.createElement("button");
    deleteButton.className = "category-action delete-category";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.setAttribute("aria-label", "Delete " + category.name);
    deleteButton.title = category.productCount > 0 ? "Remove assigned products before deleting this category" : "Delete category";
    deleteButton.disabled = category.productCount > 0;
    deleteButton.appendChild(createIcon("M4.5 6h11m-9.5 0 .6 10h7.8L15 6m-7-2h4l.7 2H7.3L8 4Zm.8 5v4m2.4-4v4", "1.4"));
    actions.append(editButton, deleteButton);
    row.appendChild(createCell(actions));
    return row;
}

function createCell(content) {
    const cell = document.createElement("td");
    if (content instanceof Node) {
        cell.appendChild(content);
    } else {
        cell.textContent = content;
    }
    return cell;
}

function updateSummary() {
    totalCategories.textContent = String(categories.length);
    activeCategories.textContent = String(categories.filter(function (category) {
        return category.isActive;
    }).length);
    archivedCategories.textContent = String(categories.filter(function (category) {
        return !category.isActive;
    }).length);
    categorizedProducts.textContent = String(categories.reduce(function (total, category) {
        return total + category.productCount;
    }, 0));
}

function renderCategories() {
    const query = categorySearch.value.trim().toLowerCase();
    const statusFilter = categoryStatusFilter.value;
    const matchingCategories = categories.filter(function (category) {
        const matchesText = category.name.toLowerCase().includes(query) ||
            category.description.toLowerCase().includes(query);
        const matchesStatus = !statusFilter ||
            (statusFilter === "active" ? category.isActive : !category.isActive);
        return matchesText && matchesStatus;
    });

    if (isDemo) {
        categoryRows.replaceChildren();
        matchingCategories.forEach(function (category) {
            categoryRows.appendChild(createCategoryRow(category, categories.indexOf(category)));
        });
        updateSummary();
    } else {
        const matchingIds = new Set(matchingCategories.map(function (category) {
            return category.id;
        }));
        categoryRows.querySelectorAll("tr").forEach(function (row) {
            row.hidden = !matchingIds.has(row.dataset.categoryId);
        });
    }
    emptyCategories.hidden = matchingCategories.length > 0;
    categoryResults.textContent = matchingCategories.length === categories.length
        ? "Showing " + categories.length + " categories"
        : "Showing " + matchingCategories.length + " of " + categories.length + " categories";
}

function showStorageError(message, error) {
    if (error) {
        console.error(message, error);
    }
    categoryStorageWarning.textContent = message;
    categoryStorageWarning.hidden = false;
}

function openCategoryDialog(category) {
    editingCategoryId = category ? category.id : null;
    categoryForm.reset();
    if (!isDemo) {
        categoryForm.action = category
            ? "/categories/" + encodeURIComponent(category.id) + "/edit/"
            : "/categories/add/";
    }
    categoryNameError.textContent = "";
    categoryNameError.classList.remove("is-visible");
    categoryNameInput.removeAttribute("aria-invalid");
    dialogMessage.textContent = "";
    dialogMessage.classList.remove("is-visible");

    if (category) {
        dialogTitle.textContent = "Edit category";
        dialogSubtitle.textContent = "Update the category details and active status.";
        saveCategoryButton.textContent = "Save changes";
        categoryNameInput.value = category.name;
        categoryDescriptionInput.value = category.description;
        categoryActiveInput.checked = category.isActive;
    } else {
        dialogTitle.textContent = "Add category";
        dialogSubtitle.textContent = "Create a new category for your inventory.";
        saveCategoryButton.textContent = "Save category";
        categoryNameInput.value = "";
        categoryDescriptionInput.value = "";
        categoryActiveInput.checked = true;
    }

    categoryDialog.showModal();
    categoryNameInput.focus();
}

function saveCategory(category) {
    const savedCategories = readSavedCategories();
    const updatedCategories = savedCategories.filter(function (savedCategory) {
        return savedCategory.id !== category.id;
    });
    updatedCategories.push(category);
    window.localStorage.setItem(categoryStorageKey, JSON.stringify(updatedCategories));
}

function handleCategorySubmit(event) {
    dialogMessage.textContent = "";
    dialogMessage.classList.remove("is-visible");

    const name = categoryNameInput.value.trim();
    if (!name) {
        event.preventDefault();
        categoryNameError.textContent = "Enter a category name.";
        categoryNameError.classList.add("is-visible");
        categoryNameInput.setAttribute("aria-invalid", "true");
        categoryNameInput.focus();
        return;
    }

    const duplicate = categories.some(function (category) {
        return category.id !== editingCategoryId && category.name.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) {
        event.preventDefault();
        categoryNameError.textContent = "A category with this name already exists.";
        categoryNameError.classList.add("is-visible");
        categoryNameInput.setAttribute("aria-invalid", "true");
        categoryNameInput.focus();
        return;
    }

    const existing = categories.find(function (category) {
        return category.id === editingCategoryId;
    });
    const category = {
        id: editingCategoryId || "samplecat-" + Date.now().toString(36),
        name: name,
        description: categoryDescriptionInput.value.trim(),
        productCount: existing ? existing.productCount : 0,
        isActive: categoryActiveInput.checked,
        createdAt: existing ? existing.createdAt : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        isDeleted: false
    };

    if (!isDemo) {
        return;
    }

    event.preventDefault();
    try {
        saveCategory(category);
    } catch (error) {
        console.error("Could not save the sample category.", error);
        dialogMessage.textContent = "Category changes could not be saved in browser storage. Check available storage and try again.";
        dialogMessage.classList.add("is-visible");
        return;
    }

    const savedCategories = readSavedCategories();
    categories = mergeCategories(savedCategories);
    renderCategories();
    categoryDialog.close();
}

function deleteCategory(category) {
    if (category.productCount > 0) {
        return;
    }

    if (!window.confirm("Delete the " + category.name + " category? This sample action cannot be undone.")) {
        return;
    }

    const deletedCategory = Object.assign({}, category, { isDeleted: true });
    try {
        saveCategory(deletedCategory);
    } catch (error) {
        showStorageError("This category could not be deleted from browser storage. Check available storage and try again.", error);
        return;
    }

    categories = categories.filter(function (item) {
        return item.id !== category.id;
    });
    renderCategories();
}

function setSidebarOpen(isOpen) {
    sidebar.classList.toggle("is-open", isOpen);
    sidebarScrim.classList.toggle("is-open", isOpen);
    sidebarToggle.setAttribute("aria-expanded", String(isOpen));
    sidebarToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
}

let savedCategories;
if (isDemo) {
    try {
        savedCategories = readSavedCategories();
        categories = mergeCategories(savedCategories);
    } catch (error) {
        storageReady = false;
        addCategoryButton.disabled = true;
        showStorageError("Saved sample categories could not be loaded. Clear the SmartStock category sample data in browser storage and refresh.", error);
        categories = seededCategories.map(function (category) {
            return Object.assign({}, category);
        });
    }
} else {
    const serverRowsTemplate = document.querySelector("#serverCategoryRows");
    categoryRows.appendChild(serverRowsTemplate.content.cloneNode(true));
    categories = Array.from(categoryRows.querySelectorAll("tr")).map(function (row) {
        return {
            id: row.dataset.categoryId,
            name: row.dataset.displayName,
            description: row.dataset.description,
            productCount: Number(row.dataset.productCount),
            isActive: row.dataset.status === "active",
            createdAt: row.dataset.createdAt
        };
    });
    categoryDataLabel.textContent = "Workspace catalog";
    const serverError = categoryStorageWarning.dataset.serverError || "";
    if (serverError && !serverError.includes("{{")) {
        categoryStorageWarning.textContent = serverError;
        categoryStorageWarning.hidden = false;
        if (categoryStorageWarning.dataset.openDialog === "true") {
            categoryDialog.showModal();
            dialogMessage.textContent = serverError;
            dialogMessage.classList.add("is-visible");
        }
    }
}
renderCategories();

addCategoryButton.addEventListener("click", function () {
    if (storageReady) {
        openCategoryDialog(null);
    }
});

document.querySelector("#closeCategoryDialog").addEventListener("click", function () {
    categoryDialog.close();
});

document.querySelector("#cancelCategoryDialog").addEventListener("click", function () {
    categoryDialog.close();
});

categoryDialog.addEventListener("click", function (event) {
    if (event.target === categoryDialog) {
        categoryDialog.close();
    }
});

categoryForm.addEventListener("submit", handleCategorySubmit);
categorySearch.addEventListener("input", renderCategories);
categoryStatusFilter.addEventListener("change", renderCategories);
categoryNameInput.addEventListener("input", function () {
    categoryNameError.textContent = "";
    categoryNameError.classList.remove("is-visible");
    categoryNameInput.removeAttribute("aria-invalid");
});

categoryRows.addEventListener("click", function (event) {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
        return;
    }

    const row = actionButton.closest("tr");
    const category = categories.find(function (item) {
        return item.id === row.dataset.categoryId;
    });
    if (!category) {
        return;
    }

    if (actionButton.dataset.action === "edit") {
        openCategoryDialog(category);
    } else if (actionButton.dataset.action === "delete") {
        if (isDemo) {
            deleteCategory(category);
        } else if (!window.confirm("Delete the " + category.name + " category? This cannot be undone.")) {
            event.preventDefault();
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
        if (categoryDialog.open) {
            categoryDialog.close();
        }
        setSidebarOpen(false);
        notificationButton.setAttribute("aria-expanded", "false");
        notificationPopover.hidden = true;
    }
});
