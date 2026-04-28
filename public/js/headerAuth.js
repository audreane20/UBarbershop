import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { opportunisticScheduleReminders } from "./reminderScheduler.js";

const ADMIN_EMAIL = "ubarbershop2023@gmail.com";

function TT(key, fallback) {
  try {
    return window.t ? window.t(key) : fallback;
  } catch {
    return fallback;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const adminTab = document.getElementById("admin-tab");
  const getAccountLink = () => document.getElementById("account-link");
  if (!getAccountLink()) return;

  let currentUser = null;
  let loginRedirectHandler = null;

  const render = (user) => {
    // Always grab the current link from the DOM (it can be replaced by other scripts)
    const link = getAccountLink();
    if (!link) return;

    // Remove prior login redirect handler (so we don't stack listeners)
    if (loginRedirectHandler) {
      link.removeEventListener("click", loginRedirectHandler);
      loginRedirectHandler = null;
    }

    // Admin tab visibility + label
    if (adminTab) {
      if (user && user.email === ADMIN_EMAIL) {
        adminTab.style.display = "inline-flex";
        adminTab.textContent = TT("nav.adminMode", "Admin Mode");
      } else {
        adminTab.style.display = "none";
      }
    }

    if (user) {
      const name =
        user.displayName && user.displayName.trim()
          ? user.displayName.trim()
          : user.email;

      const basePath = window.basePath || '/UBarbershop/public';
      link.textContent = name;
      link.href = basePath + '/profile';
      link.classList.add("logged-in");
      link.title = TT("auth.profileLinkTitle", "Go to your profile");
    } else {
      const basePath = window.basePath || '/UBarbershop/public';
      link.textContent = TT("auth.loginLink", "Login");
      link.href = basePath + '/login';
      link.classList.remove("logged-in");
      link.title = TT("auth.loginLink", "Login");

      loginRedirectHandler = () => {
        localStorage.setItem("redirectAfterLogin", window.location.href);
      };
      link.addEventListener("click", loginRedirectHandler);
    }
  };

  onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    render(currentUser);
    if (currentUser && currentUser.email === ADMIN_EMAIL) {
      try { await opportunisticScheduleReminders(); } catch (err) { console.warn("Reminder auto-scheduler skipped:", err); }
    }
  });

  // Re-render on language change (so "Login" becomes "Connexion", etc.)
  window.addEventListener("lang:changed", () => {
    render(currentUser);
  });
});
