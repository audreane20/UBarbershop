import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,

  GoogleAuthProvider,
  FacebookAuthProvider,

  signInWithPopup,
  fetchSignInMethodsForEmail,
  linkWithCredential
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const form = document.getElementById("login-form");
const errorEl = document.getElementById("error");
const forgotLink = document.getElementById("forgot-password");

const TT = (key, fallback) => {
  if (typeof window !== "undefined" && typeof window.t === "function") {
    const v = window.t(key);
    if (v != null && v !== key) return v;
  }
  return (fallback ?? key);
};

function setError(msg) {
  if (errorEl) errorEl.textContent = msg || "";
}

function friendlyAuthMessage(err) {
  switch (err?.code) {
    case "auth/user-not-found":
      return TT("auth.errors.userNotFound", "No account exists with this email. Please register first.");
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return TT("auth.errors.invalidCredential", "Incorrect email or password.");
    case "auth/invalid-email":
      return TT("auth.errors.invalidEmail", "Please enter a valid email address.");
    case "auth/missing-password":
      return TT("auth.errors.missingPassword", "Please enter your password.");
    case "auth/account-exists-with-different-credential":
      return TT(
        "auth.errors.accountExistsDifferentCredential",
        "An account already exists with this email using another sign-in method. Please sign in with the original method to link your accounts."
      );
    case "auth/too-many-requests":
      return TT("auth.errors.tooManyRequests", "Too many attempts. Please try again later.");
    default:
      return TT("auth.errors.loginFailed", "Login failed. Please try again.");
  }
}

function getRedirectAfterLogin() {
  const redirectUrl = localStorage.getItem("redirectAfterLogin");
  if (redirectUrl) {
    localStorage.removeItem("redirectAfterLogin");
    return redirectUrl;
  }
  return "home.html";
}

// =========================
// Account linking support
// =========================
// When user tries Google/Facebook but the email already exists with another method,
// we save the pending OAuth credential and link it after the user signs in with the
// existing method.
let pendingOAuthCred = null;
let pendingEmail = null;

function getPendingCredentialFromError(err) {
  // Firebase provides helper extractors for each provider.
  // Use whatever matches, plus a fallback.
  return (
    GoogleAuthProvider.credentialFromError(err) ||
    FacebookAuthProvider.credentialFromError(err) ||
    err?.credential ||
    null
  );
}

async function linkPendingIfAny(user) {
  if (!pendingOAuthCred) return;

  // Safety: only link if it's the same email address.
  if (pendingEmail && user?.email && pendingEmail !== user.email) {
    setError(TT("auth.errors.linkEmailMismatch", "You're signed in with a different email than the one you tried to link."));
    pendingOAuthCred = null;
    pendingEmail = null;
    return;
  }

  try {
    await linkWithCredential(user, pendingOAuthCred);
    pendingOAuthCred = null;
    pendingEmail = null;
    setError(""); // clear any "please login to link" message
  } catch (e) {
    // If it was already linked, we can ignore.
    if (e?.code !== "auth/provider-already-linked") {
      console.error("Link error:", e);
      setError(TT("auth.errors.linkFailed", "We couldn't link your accounts. Please try again."));
    }
    pendingOAuthCred = null;
    pendingEmail = null;
  }
}

async function handleAccountExistsDifferentCredential(err) {
  const email = err?.customData?.email || "";
  const pendingCred = getPendingCredentialFromError(err);

  if (!email || !pendingCred) {
    throw err;
  }

  const methods = await fetchSignInMethodsForEmail(auth, email);

  // If an email/password account exists, the user must sign in with password once,
  // then we link the pending Google/Facebook credential to that same user.
  if (methods.includes("password")) {
    pendingOAuthCred = pendingCred;
    pendingEmail = email;
    setError(TT(
      "auth.errors.loginWithPasswordToLink",
      "This email already has an account with a password. Please log in with email/password to link Google/Facebook."
    ));
    return; // stop here; user will submit the form
  }

  // If Google already exists, sign in with Google then link the pending credential (Facebook)
  if (methods.includes("google.com")) {
    setError(TT("auth.errors.loginWithGoogleToLink", "This email is already registered with Google. Sign in with Google to link."));
    const googleProvider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, googleProvider);
    await linkWithCredential(res.user, pendingCred);
    return;
  }

  // If Facebook already exists, sign in with Facebook then link the pending credential (Google)
  if (methods.includes("facebook.com")) {
    setError(TT("auth.errors.loginWithFacebookToLink", "This email is already registered with Facebook. Sign in with Facebook to link."));
    const fbProvider = new FacebookAuthProvider();
    const res = await signInWithPopup(auth, fbProvider);
    await linkWithCredential(res.user, pendingCred);
    return;
  }

  // Unknown method: just rethrow to be handled elsewhere.
  throw err;
}

async function oauthSignIn(provider, providerNameFallback) {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = getRedirectAfterLogin();
  } catch (err) {
    console.error(`${providerNameFallback} login error:`, err);

    if (err?.code === "auth/account-exists-with-different-credential") {
      try {
        await handleAccountExistsDifferentCredential(err);

        // If we reached here without throwing, either:
        // - accounts were linked via Google/Facebook flow, OR
        // - pending cred is waiting for password login
        if (!pendingOAuthCred) {
          // Linked via popup flow
          window.location.href = getRedirectAfterLogin();
        }
      } catch (e) {
        // If linking flow fails, show a clear message
        setError(TT(
          "auth.errors.accountExistsDifferentCredential",
          "This email is already registered using another sign-in method. Please use the original method first."
        ));
      }
      return;
    }

    if (err?.code === "auth/popup-closed-by-user") {
      setError(TT("auth.errors.popupClosed", "Popup closed. Please try again."));
      return;
    }

    setError(TT("auth.errors.oauthFailed", `${providerNameFallback} login failed. Please try again.`));
  }
}

// =========================
// Email/Password Login
// =========================
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");

    const email = document.getElementById("email")?.value.trim() || "";
    const password = document.getElementById("password")?.value || "";

    try {
      await signInWithEmailAndPassword(auth, email, password);

      // If the user previously tried Google/Facebook and got blocked, link now:
      await linkPendingIfAny(auth.currentUser);

      window.location.href = getRedirectAfterLogin();
    } catch (err) {
      console.error("Login error:", err);
      setError(friendlyAuthMessage(err));
    }
  });
}

if (forgotLink) {
  forgotLink.addEventListener("click", async (e) => {
    e.preventDefault();
    setError("");

    const email = document.getElementById("email")?.value.trim() || "";
    if (!email) {
      setError(TT("auth.errors.enterEmailFirst", "Enter your email first, then click “Forgot password?”."));
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setError(TT("auth.errors.resetSent", "Password reset email sent. Check your inbox."));
    } catch (err) {
      console.error("Reset error:", err);
      setError(TT("auth.errors.resetGeneric", "If an account exists for that email, you’ll receive a reset message shortly."));
    }
  });
}

// =========================
// Google Login
// =========================
const googleBtn = document.getElementById("google-login");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    await oauthSignIn(provider, "Google");
  });
}

// =========================
// Facebook Login
// =========================
const facebookBtn = document.getElementById("facebook-login");
if (facebookBtn) {
  facebookBtn.addEventListener("click", async () => {
    setError("");
    const provider = new FacebookAuthProvider();
    // NOTE: don't manually add scopes unless you really need them.
    // Firebase + Facebook login will request what it needs.
    await oauthSignIn(provider, "Facebook");
  });
}