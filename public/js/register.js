import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const TT = (key, fallback) => (window.t ? window.t(key) : (fallback ?? key));

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");
  const nameEl = document.getElementById("regName");
  const emailEl = document.getElementById("regEmail");
  const passEl = document.getElementById("regPassword");
  const confirmEl = document.getElementById("regConfirmPassword");
  const errEl = document.getElementById("regError");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errEl) errEl.textContent = "";

    const name = (nameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";
    const confirmPassword = confirmEl?.value || "";

    if (!name) {
      if (errEl) errEl.textContent = TT("auth.errors.nameRequired", "Please enter your name.");
      return;
    }

    if (password !== confirmPassword) {
      if (errEl) errEl.textContent = TT("auth.errors.passwordsNoMatch", "Passwords do not match.");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      window.location.href = "profile.html";
    } catch (err) {
      console.error("Register error:", err);
      if (errEl) errEl.textContent = err?.message || TT("auth.errors.registerFailed", "Registration failed. Please try again.");
    }
  });
});
