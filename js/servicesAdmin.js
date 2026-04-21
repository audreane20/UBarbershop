// servicesAdmin.js — Admin: manage booking services (add/edit/delete)
// Collection: services (doc id = serviceId)
// Fields: { id, nameEn, nameFr, duration, price, sortOrder, active, updatedAt }

import { db } from "./firebase.js";
import { requireAdmin } from "./adminGuard.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

console.log("servicesAdmin.js connected ✅");

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const t = (k, vars) => (window.t ? window.t(k, vars) : k);

  const form = $("svc-form");
  const clearBtn = $("svc-clear");

  const idEl = $("svc-id");
  const enEl = $("svc-en");
  const frEl = $("svc-fr");
  const durEl = $("svc-duration");
  const priceEl = $("svc-price");
  const orderEl = $("svc-order");
  const activeEl = $("svc-active");
  const listEl = $("svc-list");
  const msgEl = $("svc-msg");
  const errEl = $("svc-error");

  if (!form || !idEl || !enEl || !frEl || !durEl || !priceEl || !listEl) {
    console.warn("servicesAdmin.js: required elements not found on this page.");
    return;
  }

  const escapeHtml = (str) =>
    String(str ?? "").replace(/[&<>"']/g, (s) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[s])
    );

  const clearMessages = () => {
    if (msgEl) msgEl.textContent = "";
    if (errEl) errEl.textContent = "";
  };
  const showMsg = (m) => {
    if (msgEl) {
      msgEl.className = "form-success";
      msgEl.textContent = m || "";
    }
  };
  const showErr = (m) => {
    if (errEl) {
      errEl.className = "form-error";
      errEl.textContent = m || "";
    }
  };

  // ✅ Protect this page (must be logged in as admin)
  let adminOk = false;
  requireAdmin({
    loginPath: "login.html",
    onDenied: () => {
      adminOk = false;
      showErr(t("errors.adminOnly") || "Admin only. Please log in with the admin account.");
    },
    onReady: () => {
      adminOk = true;
      clearMessages();
    },
  });

  // ---------- Auto ID generation ----------
  // We generate a stable-ish id from the EN name (fallback FR), and ensure uniqueness.
  const slugify = (raw) => {
    const base = String(raw || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_");

    return base || "service";
  };

  const uniqueIdFromNames = (nameEn, nameFr, takenIds) => {
    const base = slugify(nameEn) || slugify(nameFr);
    let id = base;
    let i = 2;
    while (takenIds.has(id)) {
      id = `${base}_${i++}`;
    }
    return id;
  };

  // When editing, we keep the existing id (changing it would break references).
  let editingId = "";

  function fillForm(svc) {
    editingId = svc.id || "";
    idEl.value = editingId;
    enEl.value = svc.nameEn || "";
    frEl.value = svc.nameFr || "";
    durEl.value = svc.duration ?? "";
    priceEl.value = svc.price ?? "";
    orderEl.value = svc.sortOrder ?? 0;
    activeEl.checked = svc.active !== false;
  }

  function resetForm() {
    editingId = "";
    idEl.value = "";
    enEl.value = "";
    frEl.value = "";
    durEl.value = "";
    priceEl.value = "";
    orderEl.value = 0;
    activeEl.checked = true;
  }
  const escapeAttr = (str) => escapeHtml(str);

  function renderList() {
    if (!listEl) return;

    if (!cache.length) {
      listEl.innerHTML = `<div class="appoint-meta">${escapeHtml(t("servicesAdmin.none") || "No services yet.")}</div>`;
      return;
    }

    const lang = (localStorage.getItem("lang") || "en").toLowerCase();
    const isFr = lang.startsWith("fr");

    listEl.innerHTML = cache
      .map((s) => {
        const title = (isFr ? s.nameFr : s.nameEn) || s.id;
        const activeTxt = s.active
          ? (t("servicesAdmin.activePill") || "Active")
          : (t("servicesAdmin.inactivePill") || "Inactive");

        const orderLabel = t("servicesAdmin.order") || (isFr ? "Ordre d’affichage" : "Sort order");

        return `
          <div class="service-card" data-id="${escapeAttr(s.id)}">
            <div class="service-card-left">
              <div class="service-title">${escapeHtml(title)}</div>
              <div class="service-sub">
                                <span class="pill">${escapeHtml(String(s.duration))} min</span>
                <span class="pill">$${escapeHtml(String(s.price))}</span>
                <span class="pill pill-order">${escapeHtml(orderLabel)}: ${escapeHtml(String(s.sortOrder ?? 0))}</span>
                <span class="pill ${s.active ? "pill-on" : "pill-off"}">${escapeHtml(activeTxt)}</span>
              </div>
              ${isFr ? `<div class="service-fr">${escapeHtml(s.nameEn || "")}</div>` : `<div class="service-fr">${escapeHtml(s.nameFr || "")}</div>`}
            </div>

            <div class="service-card-actions">
              <button class="btn ghost svc-edit" type="button" data-id="${escapeAttr(s.id)}">${escapeHtml(t("servicesAdmin.edit") || "Edit")}</button>
              <button class="btn ghost danger svc-del" type="button" data-id="${escapeAttr(s.id)}">${escapeHtml(t("servicesAdmin.delete") || "Delete")}</button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // One click handler for edit/delete (event delegation)
  listEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (btn.classList.contains("svc-edit")) {
      const svc = cache.find((x) => x.id === id);
      if (!svc) return;
      clearMessages();
      fillForm(svc);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (btn.classList.contains("svc-del")) {
      const ok = window.confirm(t("confirm.deleteService") || "Delete this service?");
      if (!ok) return;
      clearMessages();
      try {
        await deleteDoc(doc(db, "services", id));
        showMsg(t("servicesAdmin.deleted") || "Deleted.");
      if (editingId && editingId === id) resetForm();
      } catch (e2) {
        console.error(e2);
        showErr(t("servicesAdmin.deleteError") || "Could not delete.");
      }
    }
  });


  clearBtn?.addEventListener("click", () => {
    clearMessages();
    resetForm();
  });

  // Live list
  const qSvc = query(collection(db, "services"), orderBy("sortOrder"));
  const cache = [];

  onSnapshot(
    qSvc,
    (snap) => {
      cache.length = 0;
      snap.forEach((d) => {
        const x = d.data() || {};
        cache.push({
          id: d.id,
          nameEn: x.nameEn || "",
          nameFr: x.nameFr || "",
          duration: Number(x.duration ?? 0),
          price: Number(x.price ?? 0),
          sortOrder: Number(x.sortOrder ?? 0),
          active: x.active !== false,
        });
      });

      // Render list
      renderList();
    },
    (err) => {
      console.error("services listener error:", err);
      const code = err?.code || "";
      if (code === "permission-denied") {
        showErr(t("errors.permission") || "Missing or insufficient permissions (Firestore rules).");
      } else {
        showErr(t("servicesAdmin.loadError") || "Could not load services.");
      }
    }
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessages();

    if (!adminOk) {
      showErr(t("errors.adminOnly") || "Admin only.");
      return;
    }

    const nameEn = (enEl.value || "").trim();
    const nameFr = (frEl.value || "").trim();
    const duration = Number(durEl.value);
    const price = Number(priceEl.value);
    const sortOrder = Number(orderEl?.value ?? 0);
    const active = !!activeEl?.checked;

    if (!nameEn || !nameFr) {
      showErr(t("servicesAdmin.nameRequired") || "Both EN and FR names are required.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      showErr(t("servicesAdmin.durationInvalid") || "Duration must be a positive number.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showErr(t("servicesAdmin.priceInvalid") || "Price must be 0 or more.");
      return;
    }

    // Decide ID:
    // - Editing: keep existing id
    // - New: auto-generate from names and ensure unique among current services
    const taken = new Set(cache.map((x) => x.id));
    const id = editingId || uniqueIdFromNames(nameEn, nameFr, taken);
    idEl.value = id; // keep hidden field in sync

    try {
      await setDoc(
        doc(db, "services", id),
        {
          id,
          nameEn,
          nameFr,
          duration,
          price,
          sortOrder,
          active,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      showMsg(t("servicesAdmin.saved") || "Saved.");
      resetForm();
    } catch (err) {
      console.error(err);
      const code = err?.code || "";
      if (code === "permission-denied") {
        showErr(t("errors.permission") || "Missing or insufficient permissions (Firestore rules).");
      } else {
        showErr(t("servicesAdmin.saveError") || "Could not save.");
      }
    }
  });

  window.addEventListener("lang:changed", () => {
    renderList();
  });
});
