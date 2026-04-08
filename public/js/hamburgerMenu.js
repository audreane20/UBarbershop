// hamburgerMenu.js — builds a mobile drawer from the existing header nav (works on main + admin)

(function () {
  const HEADER_SELECTOR = ".site-header";
  const NAV_SELECTOR = ".main-nav";

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function getSavedLang() {
    try {
      return localStorage.getItem("UB_LANG") || localStorage.getItem("lang") || "en";
    } catch {
      return "en";
    }
  }

  function applyLangNow() {
    if (typeof window.setLanguage === "function") {
      window.setLanguage(getSavedLang());
    }
  }

  function ensureToggleButton(header) {
    const actions = $(".header-actions", header) || header;
    let btn = $(".nav-toggle", actions);
    if (btn) return btn;

    btn = document.createElement("button");
    btn.className = "nav-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "Menu");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = "&#9776;"; // ☰

    // place it before the language switcher if present
    const lang = $(".lang-switcher", actions);
    if (lang) actions.insertBefore(btn, lang);
    else actions.appendChild(btn);

    return btn;
  }

  function buildDrawer(header) {
    // Avoid duplicates
    if ($(".mobile-nav-drawer")) return;

    const overlay = document.createElement("div");
    overlay.className = "mobile-nav-overlay";

    const drawer = document.createElement("aside");
    drawer.className = "mobile-nav-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");

    // Top
    const top = document.createElement("div");
    top.className = "drawer-top";

    // Brand (logo + optional title in the drawer)
    const logo = header.querySelector(".logo");
    let brandNode;

    if (logo) {
      // Clone the logo link, but normalize it so it looks consistent in the drawer
      const a = logo.cloneNode(true);

      // Remove extra images if any (some pages may include multiple logo imgs)
      const imgs = a.querySelectorAll("img");
      imgs.forEach((img, i) => { if (i > 0) img.remove(); });

      // Remove any existing text node/title span (it may be hidden on mobile via CSS)
      const existingText = a.querySelector(".logo-text");
      if (existingText) existingText.remove();

      // Ensure drawer title always shows in the hamburger menu on mobile (non-admin + admin)
      const title = document.createElement("span");
      title.className = "drawer-title";
      title.textContent = "UBarbershop";
      a.appendChild(title);

      // Prevent default link decoration in the drawer
      a.style.textDecoration = "none";
      a.style.color = "inherit";

      brandNode = a;
    } else {
      brandNode = document.createElement("div");
      brandNode.textContent = "Menu";
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "drawer-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close menu");
    closeBtn.innerHTML = "&times;";

    top.appendChild(brandNode);
    top.appendChild(closeBtn);

    // Content
    const content = document.createElement("div");
    content.className = "drawer-content";

    // Account/Admin links should be at the very top of the drawer
    const accountTop = document.createElement("div");
    accountTop.className = "drawer-account-top";

    const account = header.querySelector("#account-link");
    if (account) {
      const c = account.cloneNode(true);
      c.id = "drawer-account-link";
      accountTop.appendChild(c);
    }

    const adminTab = header.querySelector("#admin-tab");
    if (adminTab) {
      const c = adminTab.cloneNode(true);
      c.id = "drawer-admin-tab";
      accountTop.appendChild(c);
    }

    const linksWrap = document.createElement("div");
    linksWrap.className = "drawer-links";

    const nav = header.querySelector(NAV_SELECTOR);
    const navLinks = nav ? $all("a", nav) : [];
    navLinks.forEach((a) => {
      const c = a.cloneNode(true);
      linksWrap.appendChild(c);
    });

    const actionsWrap = document.createElement("div");
    actionsWrap.className = "drawer-actions";

    // Language switcher clone
    const lang = header.querySelector(".lang-switcher");
    if (lang) {
      const lc = lang.cloneNode(true);
      // wire up language buttons (clone won't have listeners)
      $all("button[data-lang]", lc).forEach((b) => {
        b.addEventListener("click", () => {
          if (typeof window.setLanguage === "function") window.setLanguage(b.dataset.lang);
          close();
        });
      });
      actionsWrap.appendChild(lc);
    }

    if (accountTop.childElementCount) content.appendChild(accountTop);
    content.appendChild(linksWrap);
    if (actionsWrap.childElementCount) content.appendChild(actionsWrap);

    drawer.appendChild(top);
    drawer.appendChild(content);

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    function syncDrawerAuthLinks() {
      // Keep drawer account/admin in sync with headerAuth.js updates
      const headerAccount = header.querySelector("#account-link");
      const drawerAccount = document.getElementById("drawer-account-link");
      if (headerAccount && drawerAccount) {
        drawerAccount.textContent = headerAccount.textContent;
        drawerAccount.href = headerAccount.getAttribute("href") || drawerAccount.href;
        drawerAccount.className = headerAccount.className;
        drawerAccount.style.display = headerAccount.style.display;
      }

      const headerAdmin = header.querySelector("#admin-tab");
      const drawerAdmin = document.getElementById("drawer-admin-tab");
      if (headerAdmin && drawerAdmin) {
        drawerAdmin.textContent = headerAdmin.textContent;
        drawerAdmin.href = headerAdmin.getAttribute("href") || drawerAdmin.href;
        drawerAdmin.className = headerAdmin.className;
        drawerAdmin.style.display = headerAdmin.style.display;
      }
    }

    function open() {
      syncDrawerAuthLinks();
      document.body.classList.add("mobile-nav-open");
      const toggle = document.querySelector(".nav-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "true");
    }

    function close() {
      document.body.classList.remove("mobile-nav-open");
      const toggle = document.querySelector(".nav-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }

    // Close on click
    overlay.addEventListener("click", close);
    closeBtn.addEventListener("click", close);

    // Close when clicking any link in drawer
    $all("a", drawer).forEach((a) => a.addEventListener("click", close));

    // ESC close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    // expose for toggle
    drawer.__open = open;
    drawer.__close = close;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const header = $(HEADER_SELECTOR);
    if (!header) return;

    const toggle = ensureToggleButton(header);
    buildDrawer(header);
    applyLangNow();

    toggle.addEventListener("click", () => {
      const drawer = $(".mobile-nav-drawer");
      if (!drawer) return;
      const isOpen = document.body.classList.contains("mobile-nav-open");
      if (isOpen) drawer.__close && drawer.__close();
      else drawer.__open && drawer.__open();
    });
  });
})();
