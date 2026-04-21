import { auth, db } from "./firebase.js";
import { BREVO_CONFIG } from "./brevo-config.js";
import {
    collection,
    getDocs,
    orderBy,
    query,
    updateDoc,
    doc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const ADMIN_EMAIL = "ubarbershop2023@gmail.com";
const LAST_RUN_KEY = "ub_reminder_scheduler_last_run_ms";
const RUN_COOLDOWN_MS = 20 * 60 * 1000;
const BREVO_WINDOW_MS = 72 * 60 * 60 * 1000;

function currentLang() {
    return (localStorage.getItem("lang") || "en").toLowerCase();
}

function TT_LANG(langCode, path, fallback) {
    try {
        if (window.tLang) {
            return window.tLang(String(langCode || currentLang()).startsWith("fr") ? "fr" : "en", path);
        }
        if (window.t) {
            const v = window.t(path);
            return v === path ? (fallback ?? path) : v;
        }
    } catch { }
    return fallback ?? path;
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (s) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    }[s]));
}

function formatDateLong(isoDate, langCode) {
    const isFr = String(langCode || currentLang()).startsWith("fr");
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

function buildReminderEmailHtml({ name, serviceName, dateFormatted, timeRange, dresser, notes, email_preview, lang }) {
    const isFr = String(lang || currentLang()).startsWith("fr");
    const E = {
        reminderTitle: TT_LANG(lang, "appoint.email.reminderTitle", isFr ? "Rappel de rendez-vous" : "Appointment Reminder"),
        reminderIntro: TT_LANG(lang, "appoint.email.reminderIntro", isFr ? "Vous avez un rendez-vous demain chez UBarbershop." : "You have an appointment tomorrow at UBarbershop."),
        with: TT_LANG(lang, "appoint.email.with", isFr ? "avec" : "with"),
        clientNotes: TT_LANG(lang, "appoint.email.clientNotes", isFr ? "Notes du client" : "Client notes"),
        thanks: TT_LANG(lang, "appoint.email.thanks", isFr ? "Merci," : "Thank you,"),
        shopPhoneLabel: TT_LANG(lang, "appoint.email.shopPhoneLabel", isFr ? "Téléphone" : "Phone"),
    };

    return `<!doctype html>
<html lang="${isFr ? "fr" : "en"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(E.reminderTitle)}</title>
  <meta name="description" content="${escapeHtml(email_preview || "")}" />
</head>
<body>
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
      </div>` : ""}

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

async function queueReminderForAppointment(appt, apptId) {
    const lang = appt.lang || currentLang();
    const dateFormatted = formatDateLong(appt.date, lang);
    const timeRange = `${appt.time || ""} – ${appt.endTime || ""}`;
    const serviceName = String(lang).startsWith("fr")
        ? (appt.serviceNameFr || appt.serviceNameEn || appt.serviceName || appt.serviceId || "")
        : (appt.serviceNameEn || appt.serviceNameFr || appt.serviceName || appt.serviceId || "");
    const email_preview = TT_LANG(
        lang,
        "appoint.email.reminderPreview",
        String(lang).startsWith("fr")
            ? "Vous avez un rendez-vous demain chez UBarbershop."
            : "You have an appointment tomorrow at UBarbershop."
    );
    const email_subject = `UBarbershop | ${TT_LANG(
        lang,
        "appoint.email.reminderSubject",
        String(lang).startsWith("fr")
            ? "Rappel : votre rendez-vous demain"
            : "Reminder: your appointment tomorrow"
    )}`;

    const htmlContent = buildReminderEmailHtml({
        name: appt.name || "",
        serviceName,
        dateFormatted,
        timeRange,
        dresser: appt.dresserName || appt.dresser || appt.dresserId || "",
        notes: (appt.notes || "").trim(),
        email_preview,
        lang,
    });

    const now = Date.now();
    const reminderAtMs = Number(appt.reminderAtMs || 0);

    if (reminderAtMs <= now) {
        await updateDoc(doc(db, "appointments", apptId), {
            reminderDelivery: "brevo",
            reminderScheduleStatus: "booked_inside_24h_window",
            reminderLastError: "",
            reminderMessageId: "",
            reminderScheduledByAutoRetryAt: serverTimestamp(),
        });
        return;
    }

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
        subject: email_subject,
        htmlContent,
        scheduledAt: new Date(reminderAtMs).toISOString(),
    };

    const res = await sendBrevoEmail(payload);

    await updateDoc(doc(db, "appointments", apptId), {
        reminderDelivery: "brevo",
        reminderScheduleStatus: "scheduled",
        reminderLastError: "",
        reminderMessageId: res?.messageId || "",
        reminderScheduledByAutoRetryAt: serverTimestamp(),
    });
}

export async function opportunisticScheduleReminders({ force = false } = {}) {
    const user = auth.currentUser;
    if (!user || user.email !== ADMIN_EMAIL) return;

    const now = Date.now();
    const lastRun = Number(localStorage.getItem(LAST_RUN_KEY) || 0);
    if (!force && now - lastRun < RUN_COOLDOWN_MS) return;
    localStorage.setItem(LAST_RUN_KEY, String(now));

    const snap = await getDocs(query(collection(db, "appointments"), orderBy("appointmentAtMs", "asc")));
    const maxReminderWindow = now + BREVO_WINDOW_MS;

    for (const d of snap.docs) {
        const appt = d.data() || {};
        if (appt.reminderSent) continue;
        if (!appt.email) continue;

        const reminderAtMs = Number(appt.reminderAtMs || 0);
        const appointmentAtMs = Number(appt.appointmentAtMs || 0);

        if (!reminderAtMs || !appointmentAtMs) continue;
        if (appointmentAtMs <= now) continue;
        if (
            appt.reminderScheduleStatus === "scheduled" ||
            appt.reminderScheduleStatus === "sent" ||
            appt.reminderScheduleStatus === "booked_inside_24h_window"
        ) continue;
        if (appt.reminderMessageId) continue;

        const inWindow = reminderAtMs <= maxReminderWindow;
        if (!inWindow) continue;

        try {
            await queueReminderForAppointment(appt, d.id);
        } catch (err) {
            try {
                await updateDoc(doc(db, "appointments", d.id), {
                    reminderDelivery: "brevo",
                    reminderScheduleStatus: "auto_retry_failed",
                    reminderLastError: String(err?.message || err || "Auto retry failed"),
                });
            } catch { }
            console.warn("Reminder auto-retry failed for", d.id, err);
        }
    }
}