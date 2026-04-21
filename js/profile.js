import { auth } from "./firebase.js";
import {
  onAuthStateChanged,
  updateProfile,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const TT = (key, fallback) => (window.t ? window.t(key) : (fallback ?? key));

// Profile page logic: load user info, allow name update, and logout.
document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("profile-name");
  const emailInput = document.getElementById("profile-email");
  const form = document.getElementById("profile-form");
  const msg = document.getElementById("profile-msg");
  const logoutBtn = document.getElementById("logout-btn");

  const setMsg = (text, isError = false) => {
    if (!msg) return;
    msg.textContent = text || "";
    msg.style.color = isError ? "#ff6b6b" : "#9ae6b4";
  };

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      localStorage.setItem("redirectAfterLogin", window.location.href);
      window.location.href = "login.html";
      return;
    }

    if (emailInput) emailInput.value = user.email || "";
    if (nameInput) nameInput.value = user.displayName || "";
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg("");

      const user = auth.currentUser;
      if (!user) {
        setMsg(TT("auth.profile.msgNotLoggedIn", "You are not logged in."), true);
        return;
      }

      const newName = (nameInput?.value || "").trim();

      try {
        await updateProfile(user, { displayName: newName });
        setMsg(TT("auth.profile.msgUpdated", "Profile updated."));
      } catch (err) {
        console.error("Profile update error:", err);
        setMsg(TT("auth.profile.msgUpdateFail", "Could not update profile. Please try again."), true);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      setMsg("");
      try {
        await signOut(auth);

        const redirectUrl = localStorage.getItem("redirectAfterLogin");
        if (redirectUrl) {
          localStorage.removeItem("redirectAfterLogin");
          window.location.href = redirectUrl;
        } else {
          window.location.href = "home.html";
        }
      } catch (err) {
        console.error("Logout error:", err);
        setMsg(TT("auth.profile.msgLogoutFail", "Logout failed. Please try again."), true);
      }
    });
  }
});
