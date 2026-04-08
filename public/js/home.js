// ===== Hidden Admin Access via Logo Click =====
const ADMIN_CODE = "1234"; // 🔒 change this

let logoClicks = 0;
let logoTimer = null;

document.addEventListener("DOMContentLoaded", () => {
    const logo = document.querySelector(".logo");
    if (!logo) return;

    logo.addEventListener("click", () => {
        logoClicks++;

        clearTimeout(logoTimer);
        logoTimer = setTimeout(() => {
            logoClicks = 0;
        }, 1500); // 1.5 second window

        if (logoClicks === 5) {
            logoClicks = 0;

            const code = prompt("Enter admin code:");
            if (code === ADMIN_CODE) {
                localStorage.setItem("admin", "true");
                window.location.href = "admin.html"; // ✅ redirect
            } else {
                alert("Incorrect code");
            }
        }
    });
});
