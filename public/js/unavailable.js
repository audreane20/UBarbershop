// unavailable.js — Admin: manage blocked/unavailable days
// Collection: unavailableDays
// Doc id: `${employeeId || 'all'}_${YYYY-MM-DD}`
// Fields: { date, employeeId: null|string, reason, createdAt, updatedAt }

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
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

console.log("unavailable.js connected ✅");

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const t = (k, vars) => (window.t ? window.t(k, vars) : k);

  const form = $("unavail-form");
  const startEl = $("unavail-start");
  const endEl = $("unavail-end");
  const empEl = $("unavail-employee");
  const reasonEl = $("unavail-reason");
  const listEl = $("unavail-list");
  const msgEl = $("unavail-msg");
  const errEl = $("unavail-error");
  const previewEl = $("unavail-preview");

  if (!form || !startEl || !endEl || !empEl || !listEl) {
    console.warn("unavailable.js: required elements not found on this page.");
    return;
  }

  // Keep end date >= start date for nicer UX
  startEl.addEventListener("change", () => {
    const s = (startEl.value || "").trim();
    if (s) endEl.min = s;
    const e = (endEl.value || "").trim();
    if (s && e && e < s) endEl.value = s;
    updatePreview();
  });

  endEl.addEventListener("change", () => {
    const s = (startEl.value || "").trim();
    const e = (endEl.value || "").trim();
    if (s && e && e < s) {
      endEl.value = s;
    }
    updatePreview();
  });

  const toLocalDate = (iso) => {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  const toIsoLocal = (dt) => {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const countDaysInclusive = (startIso, endIso) => {
    try {
      const a = toLocalDate(startIso);
      const b = toLocalDate(endIso);
      const ms = b.getTime() - a.getTime();
      if (Number.isNaN(ms)) return 0;
      return Math.floor(ms / 86400000) + 1;
    } catch {
      return 0;
    }
  };

  function updatePreview() {
    if (!previewEl) return;
    const s = (startEl.value || "").trim();
    const e = (endEl.value || "").trim();
    if (!s || !e) {
      previewEl.textContent = "";
      return;
    }
    if (e < s) {
      previewEl.textContent = "";
      return;
    }
    const n = countDaysInclusive(s, e);
    const msg = (t("unavailable.preview") || "Blocking {n} day(s): {start} → {end}")
      .replace("{n}", String(n))
      .replace("{start}", formatDateLong(s))
      .replace("{end}", formatDateLong(e));
    previewEl.innerHTML = `<strong>${escapeHtml(msg)}</strong>`;
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

  // Populate employee dropdown (reuse employees collection)
  const empNameById = new Map();
  try {
    const qEmp = query(collection(db, "employees"), orderBy("name"));
    onSnapshot(qEmp, (snap) => {
      const current = empEl.value;
      const first = empEl.querySelector('option[value="all"]');
      empEl.innerHTML = "";
      if (first) empEl.appendChild(first);
      else {
        const opt = document.createElement("option");
        opt.value = "all";
        opt.textContent = t("unavailable.all") || "All hairdressers (shop closed)";
        empEl.appendChild(opt);
      }

      empNameById.clear();
      snap.forEach((d) => {
        const data = d.data() || {};
        const id = d.id;
        const name = String(data.name || "").trim();
        if (!name) return;
        empNameById.set(id, name);
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = name;
        empEl.appendChild(opt);
      });

      // Try to keep selection
      if (current) empEl.value = current;
    });
  } catch (e) {
    console.warn("Could not load employees for unavailable days:", e);
  }

  function formatDateLong(iso) {
    // iso: YYYY-MM-DD
    try {
      const lang = (localStorage.getItem("lang") || "en").toLowerCase();
      const isFr = lang.startsWith("fr");
      const locale = isFr ? "fr-CA" : "en-CA";
      const [y, m, d] = iso.split("-").map(Number);
      const dt = new Date(y, (m || 1) - 1, d || 1);
      return dt.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } catch {
      return iso;
    }
  }

  // Render list
  const qBlocks = query(collection(db, "unavailableDays"), orderBy("date"));

  // Cache so we can re-render when the language changes
  let lastFutureRows = [];

  const renderList = (future) => {
    lastFutureRows = Array.isArray(future) ? future : [];

    if (!lastFutureRows.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-title">${escapeHtml(
        t("unavailable.none") || "No blocked days yet."
      )}</div></div>`;
      return;
    }

    listEl.innerHTML = lastFutureRows
      .map((r) => {
        const reasonLine = r.reason ? `<span class="badge gray">📝 ${escapeHtml(r.reason)}</span>` : "";
        const whoBadge = `<span class="badge blue">👤 ${escapeHtml(r.who)}</span>`;
        return `
          <div class="unavail-item">
            <div class="unavail-left">
              <div class="unavail-date">${escapeHtml(formatDateLong(r.date))}</div>
              <div class="unavail-meta">
                ${whoBadge}
                ${reasonLine}
              </div>
            </div>

            <button class="btn ghost danger unavail-del" type="button" data-id="${escapeHtml(r.id)}">
              ${escapeHtml(t("unavailable.remove") || "Remove")}
            </button>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll(".unavail-del").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!id) return;
        const ok = window.confirm(t("confirm.deleteBlockedDay") || "Remove this blocked day?");
        if (!ok) return;
        clearMessages();
        try {
          await deleteDoc(doc(db, "unavailableDays", id));
          showMsg(t("unavailable.deleted") || "Removed.");
        } catch (e) {
          console.error(e);
          showErr(t("unavailable.deleteError") || "Could not remove.");
        }
      });
    });
  };

  onSnapshot(
    qBlocks,
    (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const x = d.data() || {};
        const date = String(x.date || "");
        const employeeId = x.employeeId || "all";
        const reason = String(x.reason || "");
        if (!date) return;

        const who =
          employeeId === "all" || employeeId == null
            ? t("unavailable.allShort") || "All"
            : empNameById.get(employeeId) || employeeId;

        rows.push({ id: d.id, date, employeeId: employeeId ?? "all", reason, who });
      });

      // Filter out past dates (client-side)
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const future = rows.filter((r) => r.date >= todayIso);
      renderList(future);
    },
    (err) => {
      console.error("unavailableDays listener error:", err);
      const code = err?.code || "";
      if (code === "permission-denied") {
        showErr(t("errors.permission") || "Missing or insufficient permissions (Firestore rules).");
      } else {
        showErr(t("unavailable.loadError") || "Could not load blocked days.");
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

    const start = (startEl.value || "").trim();
    const end = (endEl.value || "").trim();
    const employeeIdRaw = (empEl.value || "all").trim();
    const employeeId = employeeIdRaw === "all" ? "all" : employeeIdRaw;
    const reason = (reasonEl?.value || "").trim();

    if (!start || !end) {
      showErr(t("unavailable.pickRange") || t("unavailable.pickDate") || "Please pick a date range.");
      return;
    }

    if (end < start) {
      showErr(t("unavailable.rangeInvalid") || "End date must be on or after start date.");
      return;
    }

    // Build all ISO dates (inclusive)
    const startDt = toLocalDate(start);
    const endDt = toLocalDate(end);
    // Safety: max 62 days at once (roughly 2 months) to avoid accidental huge writes
    const MAX_DAYS = 62;
    const days = [];
    for (let dt = new Date(startDt); dt <= endDt; dt.setDate(dt.getDate() + 1)) {
      days.push(toIsoLocal(dt));
      if (days.length > MAX_DAYS) break;
    }

    if (days.length > MAX_DAYS) {
      const msg = t("unavailable.tooMany") || `Please select a shorter range (max ${MAX_DAYS} days).`;
      showErr(String(msg).replace("{n}", String(MAX_DAYS)));
      return;
    }

    // Confirm if they are blocking multiple days
    if (days.length > 1) {
      const ok = window.confirm(
        (t("unavailable.confirmRange") || "Block these days?")
          .replace("{n}", String(days.length))
      );
      if (!ok) return;
    }

    try {
      const batch = writeBatch(db);
      const nowIso = new Date().toISOString();

      days.forEach((date) => {
        const docId = `${employeeId}_${date}`;
        batch.set(
          doc(db, "unavailableDays", docId),
          {
            date,
            employeeId: employeeId === "all" ? "all" : employeeId,
            reason,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      });

      await batch.commit();

      showMsg(
        (days.length > 1
          ? (t("unavailable.savedRange") || "Saved {n} day(s).")
          : (t("unavailable.saved") || "Saved."))
          .replace("{n}", String(days.length))
      );

      // keep employee selection, clear reason
      if (reasonEl) reasonEl.value = "";
      updatePreview();
    } catch (err) {
      console.error(err);
      const code = err?.code || "";
      if (code === "permission-denied") {
        showErr(t("errors.permission") || "Missing or insufficient permissions (Firestore rules).");
      } else {
        showErr(t("unavailable.saveError") || "Could not save.");
      }
    }
  });

  // Re-render translation-driven static options/labels
  window.addEventListener("lang:changed", () => {
    const allOpt = empEl.querySelector('option[value="all"]');
    if (allOpt) allOpt.textContent = t("unavailable.all") || allOpt.textContent;
    updatePreview();
    // Re-render list so buttons / empty-state translate too
    try { renderList(lastFutureRows); } catch {}
  });

  // Initial preview
  updatePreview();
});
