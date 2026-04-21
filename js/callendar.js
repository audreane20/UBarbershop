// callendar.js (Admin Calendar — LIVE via Firestore)
// ✅ Requires: ../js/firebase.js
// ✅ Load as: <script type="module" src="../js/callendar.js"></script>

import { auth, db } from "./firebase.js";
import { BREVO_CONFIG } from "./brevo-config.js";
import { opportunisticScheduleReminders } from "./reminderScheduler.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

console.log("callendar.js connected ✅ (Firestore live)");

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // Employees can stay in localStorage for now (admin edits) — appointments are LIVE from Firestore.
  const EMP_KEY = "employees";

  // Gate this page to your admin email (matches headerAuth.js)
  const ADMIN_EMAIL = "ubarbershop2023@gmail.com";

  const gridEl = $("cal-grid");
  const titleEl = $("cal-title");
  const weekdaysEl = $("cal-weekdays");

  const selectedTitleEl = $("selected-title");
  const selectedMetaEl = $("selected-meta");
  const listEl = $("appoint-admin-list");
  const msgEl = $("admin-calendar-msg");
  const errEl = $("admin-calendar-error");

  const prevBtn = $("cal-prev");
  const nextBtn = $("cal-next");
  const clearAllBtn = $("clear-all"); // optional (if you add the button back)

  const searchEl = $("search");
  const dresserFilterEl = $("dresser-filter");
  const cancelConfirmOverlay = $("cancel-confirm-overlay");
  const cancelConfirmYes = $("cancel-confirm-yes");
  const cancelConfirmNo = $("cancel-confirm-no");

  if (!gridEl || !titleEl || !weekdaysEl || !listEl || !searchEl || !dresserFilterEl) {
    console.warn("❌ Calendar page missing required elements.");
    return;
  }

  if (cancelConfirmOverlay) cancelConfirmOverlay.style.display = "none";

  function askCancelAppointment() {
    return new Promise((resolve) => {
      if (!cancelConfirmOverlay || !cancelConfirmYes || !cancelConfirmNo) {
        resolve(window.confirm(t("confirm.deleteAppointment") || "Are you sure?"));
        return;
      }

      cancelConfirmOverlay.style.display = "flex";
      document.body.classList.add("modal-open");

      const cleanup = () => {
        cancelConfirmOverlay.style.display = "none";
        document.body.classList.remove("modal-open");
        cancelConfirmYes.removeEventListener("click", onYes);
        cancelConfirmNo.removeEventListener("click", onNo);
        cancelConfirmOverlay.removeEventListener("click", onOverlayClick);
        document.removeEventListener("keydown", onKeyDown);
      };

      const onYes = () => { cleanup(); resolve(true); };
      const onNo = () => { cleanup(); resolve(false); };
      const onOverlayClick = (e) => { if (e.target === cancelConfirmOverlay) onNo(); };
      const onKeyDown = (e) => { if (e.key === "Escape") onNo(); };

      cancelConfirmYes.addEventListener("click", onYes, { once: true });
      cancelConfirmNo.addEventListener("click", onNo, { once: true });
      cancelConfirmOverlay.addEventListener("click", onOverlayClick);
      document.addEventListener("keydown", onKeyDown);
    });
  }

  let view = new Date();
  let selected = new Date();

  // ---- LIVE appointments cache (from Firestore) ----
  let apptCache = []; // [{ id, ...data }]
  const getAppointments = () => apptCache;

  // ---- Services cache (from Firestore) ----
  // Lets the admin calendar display service names even for services added later.
  const serviceMap = new Map(); // id -> {nameEn,nameFr}

  function getServiceName(sid) {
    if (!sid) return "";
    const svc = serviceMap.get(sid);
    if (!svc) return "";
    const lang = (localStorage.getItem("lang") || "en").toLowerCase();
    const isFr = lang.startsWith("fr");
    return (isFr ? svc.nameFr : svc.nameEn) || svc.nameEn || svc.nameFr || "";
  }

  try {
    const qSvc = query(collection(db, "services"), orderBy("sortOrder"));
    onSnapshot(qSvc, (snap) => {
      serviceMap.clear();
      snap.forEach((d) => {
        const x = d.data() || {};
        if (x.active === false) return;
        serviceMap.set(d.id, { nameEn: x.nameEn || "", nameFr: x.nameFr || "" });
      });
      renderDayList();
    });
  } catch {
    // ignore
  }

  const getEmployees = () => {
    const data = JSON.parse(localStorage.getItem(EMP_KEY));
    return Array.isArray(data) ? data : [];
  };

  const escapeHtml = (str) =>
    String(str ?? "").replace(/[&<>"']/g, (s) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[s])
    );

  const pad2 = (n) => String(n).padStart(2, "0");
  const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function cap(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getCalendarLocale() {
    return localStorage.getItem("lang") === "fr" ? "fr-CA" : "en-CA";
  }

  // Word-format date for headers
  // EN example: Thursday, May 20, 2026
  // FR example: Jeudi le 20 Mai 2026
  function formatDateLong(isoDate) {
    const d = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(isoDate || "");

    const lang = (localStorage.getItem("lang") || "en").toLowerCase();
    const isFr = lang.startsWith("fr");
    const locale = isFr ? "fr-CA" : "en-CA";

    const fmt = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const parts = fmt.formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    const weekday = cap(get("weekday"));
    const month = cap(get("month"));
    const day = get("day");
    const year = get("year");

    if (isFr) return `${weekday} le ${day} ${month} ${year}`;
    return `${weekday}, ${month} ${day}, ${year}`;
  }
  function formatDateLongByLang(isoDate, langCode) {
    const d = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(isoDate || "");

    const isFr = String(langCode || "en").toLowerCase().startsWith("fr");
    const locale = isFr ? "fr-CA" : "en-CA";
    const fmt = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const parts = fmt.formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    const weekday = cap(get("weekday"));
    const month = cap(get("month"));
    const day = get("day");
    const year = get("year");
    return isFr ? `${weekday} le ${day} ${month} ${year}` : `${weekday}, ${month} ${day}, ${year}`;
  }

  function TT_LANG(langCode, path, fallback = "") {
    if (window.tLang) {
      const out = window.tLang(String(langCode || "en").startsWith("fr") ? "fr" : "en", path);
      return out || fallback || path;
    }
    return fallback || path;
  }

  async function sendBrevoEmail(payload) {
    const res = await fetch("../send-email.php", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "send",
        payload,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Email send failed: ${res.status} ${errorText}`);
    }

    return res.json().catch(() => ({ ok: true }));
  }

  async function deleteScheduledBrevoEmail(messageId) {
    if (!messageId) {
      console.log("ℹ️ No scheduled reminder to delete (missing messageId)");
      return { skipped: true, reason: "missing_message_id" };
    }

    console.log("🗑️ Deleting scheduled reminder:", String(messageId));

    const res = await fetch("../send-email.php", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        action: "delete",
        messageId: String(messageId),
      }),
    });

    if (!res.ok && res.status !== 404) {
      const errorText = await res.text();
      throw new Error(`Email delete failed: ${res.status} ${errorText}`);
    }

    console.log("✅ Scheduled reminder deleted (or already gone)", { messageId: String(messageId), status: res.status });
    return { ok: true, status: res.status };
  }

  async function sendCancellationEmail(appt, cancelledBy = "salon") {
    if (!appt?.email) return { skipped: true };
    const lang = appt.lang || "en";
    const isFr = String(lang).startsWith("fr");
    const serviceName = (isFr ? appt.serviceNameFr : appt.serviceNameEn) || appt.serviceNameEn || appt.serviceNameFr || appt.serviceId || "Service";
    const emailSubject = TT_LANG(lang, "appoint.email.cancelledSubject", isFr ? "Rendez-vous annulé — UBarbershop" : "Appointment cancelled — UBarbershop");
    const emailPreview = TT_LANG(lang, "appoint.email.cancelledPreview", isFr ? "Votre rendez-vous chez UBarbershop a été annulé." : "Your appointment at UBarbershop has been cancelled.");

    return sendBrevoEmail({
      sender: {
        name: BREVO_CONFIG.senderName || "UBarbershop",
        email: BREVO_CONFIG.senderEmail || "ubarbershop2023@gmail.com",
      },
      replyTo: {
        email: "noreply@ubarbershop.ca",
        name: "UBarbershop"
      },
      to: [{ email: appt.email, name: appt.name || "" }],
      templateId: BREVO_CONFIG.cancelTemplateId || 4,
      params: {
        name: appt.name || "",
        service: serviceName,
        dresser: appt.dresserName || (Array.isArray(appt.dresserNames) ? appt.dresserNames.join(", ") : ""),
        date: formatDateLongByLang(appt.date || "", lang),
        time: `${appt.time || ""}${appt.endTime ? ` – ${appt.endTime}` : ""}`,
        email_cancelledTitle: TT_LANG(lang, "appoint.email.cancelledTitle", isFr ? "Rendez-vous annulé" : "Appointment Cancelled"),
        email_cancelledMessage: TT_LANG(lang, cancelledBy === "salon" ? "appoint.email.cancelledSalonIntro" : "appoint.email.cancelledClientIntro", isFr ? "Votre rendez-vous a été annulé." : "Your appointment has been cancelled."),
        email_cancelledSubject: emailSubject,
        email_cancelledPreview: emailPreview,
        email_with: TT_LANG(lang, "appoint.email.with", isFr ? "avec" : "with"),
        email_thanks: TT_LANG(lang, "appoint.email.thanks", isFr ? "Merci," : "Thanks,"),
        email_phoneLabel: TT_LANG(lang, "appoint.email.shopPhoneLabel", isFr ? "Téléphone" : "Phone"),
      },
    });
  }


  function monthName(d) {
    const locale = getCalendarLocale();
    return cap(d.toLocaleString(locale, { month: "long", year: "numeric" }));
  }

  function renderWeekdays() {
    const locale = getCalendarLocale();
    const base = new Date(2023, 0, 1); // Sunday
    const labels = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      let name = d.toLocaleDateString(locale, { weekday: "long" }).slice(0, 3);
      return cap(name);
    });

    weekdaysEl.innerHTML = labels.map((w) => `<div>${escapeHtml(w)}</div>`).join("");
  }

  function sameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  function normalizeAppointments(items) {
    return (items || []).map((a) => ({
      ...a,
      id: a.id || "",
      dressers: a.dresserName ? [a.dresserName] : (Array.isArray(a.dressers) ? a.dressers : []),
      createdAt: a.createdAt || "",
    }));
  }

  // ---- hairdresser dropdown ----
  function rebuildDresserFilter() {
    const employees = getEmployees();
    const names = employees.map((e) => e?.name).filter(Boolean);
    const current = dresserFilterEl.value;

    dresserFilterEl.innerHTML =
      `<option value="">${escapeHtml(t("calendar.allHairdressers"))}</option>` +
      names
        .slice()
        .sort()
        .map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)
        .join("");

    dresserFilterEl.value = names.includes(current) ? current : "";
  }

  // ---- filters ----
  function getFilteredAppointments() {
    const q = (searchEl.value || "").trim().toLowerCase();
    const dresser = dresserFilterEl.value;

    let items = normalizeAppointments(getAppointments());

    if (dresser) items = items.filter((a) => (a.dressers || []).includes(dresser));

    if (q) {
      items = items.filter((a) => {
        const serviceText = a.serviceLabel || a.service || a.serviceId || "";
        const hay = [
          serviceText,
          a.date,
          a.time,
          a.endTime,
          a.duration,
          a.price,
          a.name,
          a.phone,
          a.email,
          a.notes,
          (a.dressers || []).join(", "),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    items.sort((x, y) => (`${x.date} ${x.time}`).localeCompare(`${y.date} ${y.time}`));
    return items;
  }

  // ---- render month grid ----
  function renderMonth() {
    if (msgEl) msgEl.textContent = "";
    if (errEl) errEl.textContent = "";

    titleEl.textContent = monthName(view);

    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startDay = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - startDay);

    const end = new Date(view.getFullYear(), view.getMonth() + 1, 0);
    const endDay = end.getDay();
    const gridEnd = new Date(end);
    gridEnd.setDate(end.getDate() + (6 - endDay));

    const items = getFilteredAppointments();
    const countsByDate = new Map();
    items.forEach((a) => countsByDate.set(a.date, (countsByDate.get(a.date) || 0) + 1));

    gridEl.innerHTML = "";

    for (let d = new Date(start); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      const iso = toISODate(d);
      const inMonth = d.getMonth() === view.getMonth();
      const count = countsByDate.get(iso) || 0;

      const cell = document.createElement("div");
      cell.className = `cal-day ${inMonth ? "" : "muted"} ${sameDay(d, selected) ? "selected" : ""}`.trim();
      cell.dataset.date = iso;

      cell.innerHTML = `
        <div class="cal-day-top">
          <div class="cal-num">${d.getDate()}</div>
          ${count ? `<div class="cal-badge">${count}</div>` : ``}
        </div>
      `;

      const clickedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

      cell.addEventListener("click", () => {
        selected = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), clickedDate.getDate());
        if (clickedDate.getMonth() !== view.getMonth()) {
          view = new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1);
        }
        renderMonth();
        renderDayList();
      });

      gridEl.appendChild(cell);
    }
  }

  function renderDayList() {
    const iso = toISODate(selected);
    const items = getFilteredAppointments().filter((a) => a.date === iso);

    selectedTitleEl.textContent = `${t("calendar.pageTitle")} — ${formatDateLong(iso)}`;
    selectedMetaEl.textContent = items.length
      ? t("calendar.count", { n: items.length })
      : t("calendar.noAppointments");

    if (!items.length) {
      listEl.innerHTML = `<div class="appoint-meta">${escapeHtml(t("calendar.noAppointmentsDay"))}</div>`;
      return;
    }

    listEl.innerHTML =
      items
        .map((a) => {
          const sid = a.serviceId || a.service || "";
          const fromDb = getServiceName(sid);
          const translated = sid ? t(`services.${sid}`) : "";
          const serviceLine =
            fromDb
              ? fromDb
              : translated && translated !== `services.${sid}`
                ? translated
                : a.serviceLabel || a.service || a.serviceId || "Service";
          const dur = a.duration ? ` (${escapeHtml(a.duration)}min)` : "";
          const cost = a.price !== null && a.price !== undefined && a.price !== "" ? ` (${escapeHtml(a.price)}$)` : "";
          const end = a.endTime ? ` – ${escapeHtml(a.endTime)}` : "";

          return `
        <div class="appoint-item">
          <div>
            <strong>${escapeHtml(a.time)}${end} — ${escapeHtml(serviceLine)}${dur}${cost}</strong>
            <div class="appoint-meta">${escapeHtml(t("calendar.hairdresser"))} ${escapeHtml((a.dressers || []).join(", "))}</div>
            <div class="appoint-meta">${escapeHtml(a.name || "")} • ${escapeHtml(a.phone || "")}${a.email ? " • " + escapeHtml(a.email) : ""}</div>
            ${a.notes ? `<div class="appoint-meta">${escapeHtml(a.notes)}</div>` : ""}
          </div>
          <button class="btn ghost danger remove-one" data-id="${escapeHtml(String(a.id || ""))}" type="button">
            ${escapeHtml(t("calendar.remove"))}
          </button>
        </div>
      `;
        })
        .join("");

    listEl.querySelectorAll(".remove-one").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!id) return;
        try {
          const appt = (apptCache || []).find((x) => String(x.id) === String(id));
          const lockId = appt?.lockId || "";

          const ok = await askCancelAppointment();
          if (!ok) return;

          try {
            await deleteScheduledBrevoEmail(appt?.reminderMessageId || "");
          } catch (err) {
            console.warn("⚠️ Could not delete scheduled reminder:", err);
          }

          await deleteDoc(doc(db, "appointments", id));

          // Free the slot lock (so the time becomes available again)
          if (lockId) {
            try { await deleteDoc(doc(db, "slotLocks", lockId)); } catch {}
          }

          if (appt?.email) {
            try {
              await sendCancellationEmail(appt, "salon");
            } catch (emailErr) {
              console.error("❌ Cancellation email failed:", emailErr);
            }
          }

          if (msgEl) msgEl.textContent = t("calendar.removed");
        } catch (e) {
          console.error("❌ Delete failed:", e);
          if (errEl) errEl.textContent = `${e?.code || "error"}: ${e?.message || "Could not delete."}`;
        }
      });
    });
  }

  // ---- Firestore live listener ----
  function startLiveListener() {
    const col = collection(db, "appointments");

    // Listen to ALL appointments and sort client-side (no index headaches).
    return onSnapshot(
      col,
      (snap) => {
        apptCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderMonth();
        renderDayList();
      },
      (err) => {
        console.error("❌ Firestore listener error:", err);
        if (errEl) errEl.textContent = `${err.code || "error"}: ${err.message || "Could not load appointments."}`;
      }
    );
  }

  // ---- events ----
  prevBtn?.addEventListener("click", () => {
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
    renderMonth();
  });

  nextBtn?.addEventListener("click", () => {
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    renderMonth();
  });

  clearAllBtn?.addEventListener("click", async () => {
    // Optional: delete ALL appointments (admin-only). Add a button with id="clear-all" if you want.
    try {
      const snap = await getDocs(collection(db, "appointments"));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      if (msgEl) msgEl.textContent = t("calendar.cleared");
    } catch (e) {
      console.error("❌ Clear all failed:", e);
      if (errEl) errEl.textContent = `${e?.code || "error"}: ${e?.message || "Could not clear."}`;
    }
  });

  searchEl.addEventListener("input", () => {
    renderMonth();
    renderDayList();
  });

  dresserFilterEl.addEventListener("change", () => {
    renderMonth();
    renderDayList();
  });

  window.addEventListener("lang:changed", () => {
    renderWeekdays();
    rebuildDresserFilter();
    renderMonth();
    renderDayList();
  });

  // ---- init ----
  renderWeekdays();
  rebuildDresserFilter();

  const now = new Date();
  selected = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  view = new Date(now.getFullYear(), now.getMonth(), 1);
  renderMonth();
  renderDayList();

  // ✅ Auth gate + start live listener
  let unsubscribe = null;
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    if (user.email !== ADMIN_EMAIL) {
      window.location.href = "home.html";
      return;
    }
    try { opportunisticScheduleReminders(); } catch (err) { console.warn("Reminder auto-scheduler skipped:", err); }
    if (!unsubscribe) unsubscribe = startLiveListener();
  });
});
