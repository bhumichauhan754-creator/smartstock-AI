const authForm = document.getElementById("authForm");
const authMessage = document.getElementById("authMessage");
const isSignup = window.location.pathname === "/signup";

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = {
        email: document.getElementById("email").value,
        password: document.getElementById("password").value,
    };
    if (isSignup) body.name = document.getElementById("name").value;
    try {
        const response = await fetch(isSignup ? "/api/auth/signup" : "/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Authentication failed");
        window.location.href = "/";
    } catch (error) {
        authMessage.textContent = error.message;
        authMessage.classList.remove("d-none");
    }
});
