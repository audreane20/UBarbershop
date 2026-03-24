import { db } from "./firebase.js";
import { BREVO_CONFIG } from "./brevo-config.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const statusEl = document.getElementById("runner-status");
const logEl = document.getElementById("runner-log");
const runBtn = document.getElementById("runner-run-now");
const toggleBtn = document.getElementById("runner-toggle");

const CHECK_EVERY_MS = 60 * 1000;
let timer = null;
let isRunning = false;

function log(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  console.log(line);
  if (logEl) {
    logEl.textContent = `${line}
${logEl.textContent || ""}`.trim();
  }
}

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function currentLang() {
  return (localStorage.getItem("lang") || "en").toLowerCase();
}

function TT_LANG(langCode, path, fallback = "") {
  if (window.tLang) return window.tLang(String(langCode || "en").startsWith("fr") ? "fr" : "en", path) || fallback;
  if (window.t) return window.t(path) || fallback;
  return fallback || path;
}

function formatDateLong(isoDate, langCode = currentLang()) {
  const isFr = String(langCode || "en").startsWith("fr");
  const locale = isFr ? "fr-CA" : "en-CA";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(isoDate || "");

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildReminderEmailHtml({ name, serviceName, dateFormatted, timeRange, dresser, notes, email_preview, E, lang }) {
  const isFr = String(lang || currentLang()).startsWith("fr");
  const safePreview = escapeHtml(email_preview || "");
  return `<!DOCTYPE html>
<html lang="${isFr ? "fr" : "en"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(E.reminderTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#333;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreview}</div>
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px;line-height:1.5;color:#fff;background-color:#333;padding:24px 12px;margin:0;">
    <div style="max-width:600px;margin:0 auto;background-color:#333;padding:16px 18px;">
      <div style="border-top:6px solid #458500;padding:16px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:10px;vertical-align:middle;">
              <img src="https://i.postimg.cc/N009YmbD/logo-modified.png" alt="" width="35" height="35" style="display:block;width:35px;height:35px;border:0;outline:none;text-decoration:none;" />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:16px;font-weight:700;color:#fff;">${escapeHtml(E.reminderTitle)}</span>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 10px 0;">${escapeHtml(name)},</p>
      <p style="margin:0 0 14px 0;">${escapeHtml(E.reminderIntro)}</p>

      <div style="margin:14px 0;padding:12px 0;border-top:1px solid rgba(255,255,255,.25);border-bottom:1px solid rgba(255,255,255,.25);">
        <p style="margin:0;">
          <strong>${escapeHtml(serviceName)}</strong> ${escapeHtml(E.with)} <strong>${escapeHtml(dresser)}</strong><br/>
          ${escapeHtml(dateFormatted)}, ${escapeHtml(timeRange)}
        </p>
      </div>

      ${notes ? `
      <div style="margin:14px 0 0 0;">
        <p style="margin:0 0 14px 0;">
          <strong>${escapeHtml(E.clientNotes)}</strong><br/>
          ${escapeHtml(notes)}
        </p>
      </div>` : '<span style="display:none;">.</span>'}

      <p style="margin:0;">
        ${escapeHtml(E.thanks)}<br/>
        UBarbershop
      </p>

      <p style="margin:10px 0 0 0;">${escapeHtml(E.shopPhoneLabel)}: (450) 472-0174</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendBrevoEmail(payload) {
  if (!BREVO_CONFIG?.apiKey || BREVO_CONFIG.apiKey.includes("PASTE_YOUR_BREVO_API_KEY")) {
    log("Brevo API key missing. Reminder skipped.");
    return { skipped: true, reason: "missing_brevo_api_key" };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": BREVO_CONFIG.apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Brevo send failed: ${res.status} ${errorText}`);
  }

  return res.json().catch(() => ({ ok: true }));
}

async function sendReminderEmail(appt) {
  const lang = appt.lang || currentLang();
  const isFr = String(lang).startsWith("fr");
  const serviceName = (isFr ? appt.serviceNameFr : appt.serviceNameEn) || appt.serviceNameEn || appt.serviceNameFr || appt.serviceId || "Service";
  const endTime = appt.endTime || appt.time || "";
  const emailSubject = `UBarbershop | ${TT_LANG(lang, "appoint.email.reminderSubject", isFr ? "Rappel : votre rendez-vous demain" : "Reminder: your appointment tomorrow")}`;
  const emailPreview = TT_LANG(lang, "appoint.email.reminderPreview", isFr ? "Vous avez un rendez-vous demain chez UBarbershop." : "You have an appointment tomorrow at UBarbershop.");

  const E = {
    reminderTitle: TT_LANG(lang, "appoint.email.reminderTitle", isFr ? "Rappel de rendez-vous" : "Appointment Reminder"),
    reminderIntro: TT_LANG(lang, "appoint.email.reminderIntro", isFr ? "Vous avez un rendez-vous demain chez UBarbershop." : "You have an appointment tomorrow at UBarbershop."),
    with: TT_LANG(lang, "appoint.email.with", isFr ? "avec" : "with"),
    clientNotes: TT_LANG(lang, "appoint.email.clientNotes", isFr ? "Notes du client" : "Client notes"),
    thanks: TT_LANG(lang, "appoint.email.thanks", isFr ? "Merci," : "Thank you,"),
    shopPhoneLabel: TT_LANG(lang, "appoint.email.shopPhoneLabel", isFr ? "Téléphone" : "Phone"),
  };

  const htmlContent = buildReminderEmailHtml({
    name: appt.name || "",
    serviceName,
    dateFormatted: formatDateLong(appt.date || "", lang),
    timeRange: `${appt.time || ""} – ${endTime}`,
    dresser: appt.dresserName || (Array.isArray(appt.dresserNames) ? appt.dresserNames.join(", ") : ""),
    notes: (appt.notes || "").trim(),
    email_preview: emailPreview,
    E,
    lang,
  });

  const payload = {
    sender: {
      name: BREVO_CONFIG.senderName || "UBarbershop",
      email: BREVO_CONFIG.senderEmail || "ubarbershop2023@gmail.com",
    },
    replyTo: {
      email: "noreply@ubarbershop.ca",
      name: "UBarbershop",
    },
    to: [{ email: appt.email, name: appt.name || "" }],
    subject: emailSubject,
    htmlContent,
  };

  return sendBrevoEmail(payload);
}

function isDueReminder(appt, now) {
  if (!appt || !appt.email) return false;
  if (appt.reminderSent) return false;
  if (!appt.reminderAtMs) return false;
  return Number(appt.reminderAtMs) <= now;
}

async function processDueReminders() {
  if (isRunning) return;
  isRunning = true;
  setStatus("Checking reminders...");

  try {
    const snap = await getDocs(collection(db, "appointments"));
    const now = Date.now();
    const due = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((appt) => isDueReminder(appt, now));

    if (!due.length) {
      setStatus("No reminders due right now.");
      log("No reminders due.");
      return;
    }

    log(`Found ${due.length} due reminder(s).`);

    for (const appt of due) {
      try {
        log(`Sending reminder for ${appt.name || appt.email} (${appt.date || ""} ${appt.time || ""})`);
        await sendReminderEmail(appt);
        await updateDoc(doc(db, "appointments", appt.id), {
          reminderSent: true,
          reminderSentAt: serverTimestamp(),
          reminderDelivery: "runner",
          reminderScheduleStatus: "sent",
          reminderLastError: "",
        });
        log(`Reminder sent to ${appt.email}.`);
      } catch (err) {
        console.error("Reminder send failed:", err);
        await updateDoc(doc(db, "appointments", appt.id), {
          reminderDelivery: "runner",
          reminderScheduleStatus: "send_failed",
          reminderLastError: String(err?.message || err || "Reminder send failed"),
        }).catch(() => {});
        log(`Reminder failed for ${appt.email}: ${err?.message || err}`);
      }
    }

    setStatus("Reminder check complete.");
  } catch (err) {
    console.error(err);
    setStatus(`Reminder runner error: ${err?.message || err}`);
    log(`Runner error: ${err?.message || err}`);
  } finally {
    isRunning = false;
  }
}

function startRunner() {
  if (timer) clearInterval(timer);
  processDueReminders();
  timer = setInterval(processDueReminders, CHECK_EVERY_MS);
  if (toggleBtn) toggleBtn.textContent = "Pause auto-check";
}

function stopRunner() {
  if (timer) clearInterval(timer);
  timer = null;
  setStatus("Auto-check paused.");
  if (toggleBtn) toggleBtn.textContent = "Resume auto-check";
}

runBtn?.addEventListener("click", () => processDueReminders());

toggleBtn?.addEventListener("click", () => {
  if (timer) stopRunner();
  else startRunner();
});

setStatus("Reminder runner ready. It checks every minute while this page stays open.");
log("Runner started. Keep this page open on the shop computer while using localhost.");
startRunner();
