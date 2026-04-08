// adminGuard.js — shared helper to protect admin pages
// Redirects to login if not signed in, and blocks non-admin users.

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

export const ADMIN_EMAIL = "ubarbershop2023@gmail.com";

export function requireAdmin({
  // From /HTML/*.html, login is in the same folder in your project.
  // If your path differs, change this when calling requireAdmin().
  loginPath = "login.html",
  onDenied = null,
  onReady = null,
} = {}) {
  const deny = (user) => {
    if (typeof onDenied === "function") return onDenied(user);
    window.location.href = loginPath;
  };

  onAuthStateChanged(auth, (user) => {
    if (!user) return deny(null);
    const email = (user.email || "").toLowerCase();
    if (email !== ADMIN_EMAIL) return deny(user);
    if (typeof onReady === "function") onReady(user);
  });
}
