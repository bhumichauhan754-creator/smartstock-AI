async function reviewRequest(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (response.status === 401) {
        window.location.href = "/login";
        return null;
    }
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
}

const reviewProductsTable = document.getElementById("reviewProductsTable");

async function loadReviewProducts() {
    if (!reviewProductsTable) return;
    try {
        const products = await reviewRequest("/api/products");
        const detailedProducts = await Promise.all(
            products.map((product) => reviewRequest(`/api/products/${product.id}`)),
        );
        renderReviewProducts(detailedProducts);
        document.getElementById("reviewProductSearch").addEventListener("input", (event) => {
            const query = event.target.value.toLowerCase();
            renderReviewProducts(detailedProducts.filter((product) => product.name.toLowerCase().includes(query)));
        });
    } catch (error) {
        reviewProductsTable.innerHTML = `<tr><td colspan="5" class="table-message">${escapeReviewHtml(error.message)}</td></tr>`;
    }
}

function renderReviewProducts(products) {
    if (!products.length) {
        reviewProductsTable.innerHTML = '<tr><td colspan="5" class="table-message">No products found.</td></tr>';
        return;
    }
    reviewProductsTable.innerHTML = products.map((product) => `
        <tr>
            <td class="product-name">${escapeReviewHtml(product.name)}</td>
            <td>${product.quantity}</td>
            <td><span class="review-stars">${product.average_rating ? `${product.average_rating.toFixed(1)} / 5` : "No rating"}</span></td>
            <td>${product.review_count}</td>
            <td><a class="btn btn-sm btn-outline-primary" href="/product-details?id=${product.id}">View reviews</a></td>
        </tr>
    `).join("");
}

const productId = new URLSearchParams(window.location.search).get("id");
const productMessage = document.getElementById("productMessage");

function showProductError(message) {
    productMessage.textContent = message;
    productMessage.classList.remove("d-none");
}

function renderReviews(reviews) {
    const list = document.getElementById("reviewList");
    list.innerHTML = reviews.length
        ? reviews.map((review) => `
            <article class="review-item">
                <div class="d-flex justify-content-between gap-3">
                    <strong>${escapeReviewHtml(review.user_name)}</strong>
                    <span class="review-stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span>
                </div>
                <p class="mb-1">${escapeReviewHtml(review.comment)}</p>
                <small class="text-muted">${new Date(review.created_at).toLocaleString()}</small>
            </article>
        `).join("")
        : '<p class="text-muted mb-0">No reviews yet.</p>';
}

function escapeReviewHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
    }[character]));
}

async function loadProductReviews() {
    if (!productId) {
        showProductError("A product ID is required.");
        return;
    }
    try {
        const [product, reviews] = await Promise.all([
            reviewRequest(`/api/products/${productId}`),
            reviewRequest(`/api/products/${productId}/reviews`),
        ]);
        document.getElementById("productName").textContent = product.name;
        document.getElementById("productQuantity").textContent = product.quantity;
        document.getElementById("productPrice").textContent = product.unit_price;
        document.getElementById("productRating").textContent =
            `${product.average_rating.toFixed(1)} / 5 (${product.review_count})`;
        renderReviews(reviews);
    } catch (error) {
        showProductError(error.message);
    }
}

document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
        await reviewRequest("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    });
});

const reviewForm = document.getElementById("reviewForm");
if (reviewForm) reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await reviewRequest(`/api/products/${productId}/reviews`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rating: Number(document.getElementById("reviewRating").value),
                comment: document.getElementById("reviewComment").value,
            }),
        });
        document.getElementById("reviewForm").reset();
        await loadProductReviews();
    } catch (error) {
        showProductError(error.message);
    }
});

if (document.getElementById("reviewForm")) loadProductReviews();
loadReviewProducts();
