console.log("SLOTLOCKS_BUILD v1 ✅");
// appointment.js (Firebase Auth + Firestore appointments)
// ✅ Requires: ./firebase.js
// ✅ Loaded as: <script type="module" src="../js/appointment.js"></script>

import { auth, db } from "./firebase.js";
import { BREVO_CONFIG } from "./brevo-config.js";

import {
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    getDoc,
    deleteDoc,
    doc,
    runTransaction,
    serverTimestamp,
    onSnapshot,
    setDoc,
    updateDoc,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

console.log("appointment.js connected ✅");

document.addEventListener("DOMContentLoaded", () => {
    const $ = (id) => document.getElementById(id);
    const TT = (path, vars) => (window.t ? window.t(path, vars) : path);

    // ---- Date formatting helper (word format, EN/FR) ----
    // EN example: Thursday, May 20, 2026
    // FR example: Jeudi le 20 Mai 2026
    function formatDateLong(isoDate) {
        const lang = (localStorage.getItem("lang") || "en").toLowerCase();
        const isFr = lang.startsWith("fr");
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

        // Use parts so we don't depend on locale punctuation/spaces
        const parts = fmt.formatToParts(d);
        const get = (type) => parts.find((p) => p.type === type)?.value || "";
        const weekday = cap(get("weekday"));
        const month = cap(get("month"));
        const day = get("day");
        const year = get("year");

        if (isFr) return `${weekday} le ${day} ${month} ${year}`;
        return `${weekday}, ${month} ${day}, ${year}`;
    }


    function toLocalDateTimeMs(isoDate, time24) {
        if (!isoDate || !time24) return null;

        const [year, month, day] = String(isoDate).split("-").map(Number);
        const [hour, minute] = String(time24).split(":").map(Number);

        if (
            !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) ||
            !Number.isFinite(hour) || !Number.isFinite(minute)
        ) {
            return null;
        }

        const d = new Date(year, month - 1, day, hour, minute, 0, 0);
        return Number.isNaN(d.getTime()) ? null : d.getTime();
    }

    function getReminderAtMsLocal24hBefore(isoDate, time24) {
        if (!isoDate || !time24) return null;

        const [year, month, day] = String(isoDate).split("-").map(Number);
        const [hour, minute] = String(time24).split(":").map(Number);

        if (
            !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) ||
            !Number.isFinite(hour) || !Number.isFinite(minute)
        ) {
            return null;
        }

        // "24 hours before" for the user should mean the same local clock time
        // on the previous calendar day, even across DST changes.
        const d = new Date(year, month - 1, day - 1, hour, minute, 0, 0);
        return Number.isNaN(d.getTime()) ? null : d.getTime();
    }
    // ========= Required elements =========
    const form = $("appoint-form");
    const errorEl = $("appoint-error");
    const successEl = $("appoint-success");
    const listEl = $("appoint-list");
    const clearBtn = $("clear-appoint");
    const pastOverlay = $("passed-appointments-overlay");
    const pastListEl = $("passed-appointments-list");
    const pastCloseBtn = $("passed-appointments-close");
    const serviceSelect = $("service");
    const timeSelect = $("time");
    const dateInput = $("date");
    const calendarEl = $("booking-calendar");
    const timeHintEl = $("time-hint");

    // ========= Auth UI =========
    const authEmail = $("auth-email");
    const authPass = $("auth-pass");
    const authMsg = $("auth-msg");
    const authStatus = $("auth-status");
    const btnSignup = $("btn-signup");
    const btnLogin = $("btn-login");
    const btnLogout = $("btn-logout");


    // ========= Login-required modal (blocks booking when not logged in) =========
    // NOTE: We do NOT rely on the HTML "hidden" attribute because author CSS can override it.
    // We force visibility with inline style.display, which always wins.
    const loginOverlay = $("login-required-overlay");
    const loginOverlayLogin = $("login-required-login");
    const loginOverlayRegister = $("login-required-register");
    const cancelConfirmOverlay = $("cancel-confirm-overlay");
    const cancelConfirmYes = $("cancel-confirm-yes");
    const cancelConfirmNo = $("cancel-confirm-no");

    // Ensure it's hidden by default on first paint
    if (loginOverlay) loginOverlay.style.display = "none";
    if (cancelConfirmOverlay) cancelConfirmOverlay.style.display = "none";

    function showLoginRequired() {
        if (!loginOverlay) return;
        // remember where to return after login
        try { localStorage.setItem("redirectAfterLogin", window.location.href); } catch { }
        loginOverlay.style.display = "flex";
        document.body.classList.add("modal-open");
    }

    function hideLoginRequired() {
        if (!loginOverlay) return;
        loginOverlay.style.display = "none";
        document.body.classList.remove("modal-open");
    }

    // Always set redirect when clicking login/register in the modal
    if (loginOverlayLogin) {
        loginOverlayLogin.addEventListener("click", () => {
            try { localStorage.setItem("redirectAfterLogin", window.location.href); } catch { }
        });
    }
    if (loginOverlayRegister) {
        loginOverlayRegister.addEventListener("click", () => {
            try { localStorage.setItem("redirectAfterLogin", window.location.href); } catch { }
        });
    }

    function askCancelAppointment() {
        return new Promise((resolve) => {
            if (!cancelConfirmOverlay || !cancelConfirmYes || !cancelConfirmNo) {
                resolve(window.confirm(TT("confirm.deleteAppointment") || "Are you sure?"));
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

    const EMP_KEY = "employees";

    if (
        !form ||
        !errorEl ||
        !successEl ||
        !listEl ||
        !clearBtn ||
        !pastOverlay ||
        !pastListEl ||
        !pastCloseBtn ||
        !serviceSelect ||
        !timeSelect ||
        !dateInput ||
        !calendarEl
    ) {
        console.warn("appointment.js: required elements not found on this page.");
        return;
    }

    // Hide/show the WHOLE date+time row (your HTML uses a .row with 2 cols)
    const bookingRow = dateInput.closest(".row") || timeSelect.closest(".row");

    // ========= Firebase session + cache =========
    let currentUser = null;
    let apptCache = []; // appointments for this user (from Firestore)

    // ========= Shared employees (Firestore first, localStorage fallback) =========
    let employeesCache = []; // [{id,name,schedule,...}]
    let employeesUnsub = null;

    // ========= Live slot locks (prevents double-booking) =========
    let lockUnsub = null;
    let lockIdSet = new Set(); // lock doc IDs for selected date + selected employees

    function normalizeIdPart(v) {
        return String(v || "")
            .trim()
            .replace(/\s+/g, "_")
            .replace(/[\/\\#?]/g, "-");
    }

    function makeLockId(employeeId, dateISO, timeHHMM) {
        return `${normalizeIdPart(employeeId)}__${normalizeIdPart(dateISO)}__${normalizeIdPart(
            timeHHMM
        )}`;
    }

    function isLocked(employeeId, dateISO, timeHHMM) {
        return lockIdSet.has(makeLockId(employeeId, dateISO, timeHHMM));
    }

    function stopLockListener() {
        if (typeof lockUnsub === "function") {
            try {
                lockUnsub();
            } catch { }
        }
        lockUnsub = null;
        lockIdSet = new Set();
    }

    function startLockListener(dateISO, employeesPool) {
        stopLockListener();

        const ids = (employeesPool || []).map((e) => e?.id).filter(Boolean);
        if (!dateISO || !ids.length) return;

        const idsSet = new Set(ids);

        const q = query(collection(db, "slotLocks"), where("date", "==", dateISO));

        lockUnsub = onSnapshot(
            q,
            (snap) => {
                const next = new Set();
                snap.forEach((d) => {
                    const data = d.data() || {};
                    if (idsSet.has(data.employeeId)) next.add(d.id);
                });
                lockIdSet = next;

                // Update time options live when someone else books
                buildTimeOptionsDynamic(true, true);
            },
            (err) => console.error("❌ slotLocks listener error:", err)
        );
    }

    const getAppointments = () => apptCache;

    // ========= Services (Firestore first, fallback to translations) =========
    const FALLBACK_SERVICES = [
        { id: "haircut", labelPath: "services.haircut", duration: 30, price: 30 },
        { id: "kids", labelPath: "services.kids", duration: 30, price: 25 },
        { id: "beard", labelPath: "services.beard", duration: 15, price: 17 },
        { id: "hair_beard", labelPath: "services.hair_beard", duration: 30, price: 37 },
    ];

    let servicesCache = []; // [{id,nameEn,nameFr,duration,price,active,sortOrder}] or fallback shape

    function currentLang() {
        return (localStorage.getItem("lang") || document.documentElement.lang || "en").toLowerCase();
    }

    async function loadServicesOnce() {
        try {
            const q = query(collection(db, "services"), orderBy("sortOrder"));
            const snap = await getDocs(q);
            const list = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .filter((x) => x && x.id);

            // Only use Firestore services if there is at least 1 active service
            const usable = list.filter((s) => s.active !== false);
            if (usable.length) {
                servicesCache = usable
                    .map((s) => ({
                        id: String(s.id),
                        nameEn: String(s.nameEn || ""),
                        nameFr: String(s.nameFr || ""),
                        duration: Number(s.duration ?? 0),
                        price: Number(s.price ?? 0),
                        sortOrder: Number(s.sortOrder ?? 0),
                        active: s.active !== false,
                    }))
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                return;
            }
        } catch (e) {
            // ignore and fallback
            console.warn("Services Firestore load failed, using fallback.", e);
        }

        servicesCache = [...FALLBACK_SERVICES];
    }

    const getServiceById = (id) => (servicesCache || []).find((s) => s.id === id);

    // Service label helper (supports Firestore services + fallback translated services)
    function getServiceDisplayName(s) {
        if (!s) return "";
        // Firestore service
        if (s.nameEn || s.nameFr) {
            const isFr = currentLang().startsWith("fr");
            return isFr
                ? (s.nameFr || s.nameEn || s.id || "")
                : (s.nameEn || s.nameFr || s.id || "");
        }
        // Fallback translated service
        if (s.labelPath) return TT(s.labelPath);
        return s.id || "";
    }

    function serviceText(s) {
        // Firestore service
        if (s && (s.nameEn || s.nameFr)) {
            const isFr = currentLang().startsWith("fr");
            const nm = isFr ? (s.nameFr || s.nameEn) : (s.nameEn || s.nameFr);
            return `${nm} (${s.duration}min) (${s.price}$)`;
        }
        // Fallback translated service
        return `${TT(s.labelPath)} (${s.duration}min) (${s.price}$)`;
    }

    function buildServiceOptions() {
        const hasPlaceholder =
            serviceSelect.options &&
            serviceSelect.options.length &&
            (serviceSelect.options[0].value === "" || serviceSelect.options[0].disabled);

        const optionsHtml = (servicesCache || []).map(
            (s) => `<option value="${s.id}">${serviceText(s)}</option>`
        ).join("");

        if (hasPlaceholder) {
            const first = serviceSelect.options[0].outerHTML;
            serviceSelect.innerHTML = first + optionsHtml;
        } else {
            serviceSelect.innerHTML = optionsHtml;
        }
    }

    // Live update in case admin edits services while client page is open
    let servicesUnsub = null;
    function startServicesListener() {
        try {
            servicesUnsub?.();
            const q = query(collection(db, "services"), orderBy("sortOrder"));
            servicesUnsub = onSnapshot(q, (snap) => {
                const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
                    .filter((s) => s && s.id && s.active !== false)
                    .map((s) => ({
                        id: String(s.id),
                        nameEn: String(s.nameEn || ""),
                        nameFr: String(s.nameFr || ""),
                        duration: Number(s.duration ?? 0),
                        price: Number(s.price ?? 0),
                        sortOrder: Number(s.sortOrder ?? 0),
                        active: s.active !== false,
                    }))
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

                if (list.length) {
                    const prev = serviceSelect.value;
                    servicesCache = list;
                    buildServiceOptions();
                    if (prev) serviceSelect.value = prev;
                    renderCalendar();
                }
            });
        } catch {
            // ignore
        }
    }

    // ========= Unavailable days (Firestore) =========
    // Map date -> Set(employeeId|'all')
    let unavailMap = new Map();
    let unavailUnsub = null;

    function isDateBlocked(isoDate, employeeIds) {
        const set = unavailMap.get(isoDate);
        if (!set || !set.size) return false;
        if (set.has("all")) return true;
        if (!employeeIds || !employeeIds.length) return false;
        return employeeIds.some((id) => set.has(id));
    }

    function startUnavailableListener() {
        try {
            unavailUnsub?.();
            const q = query(collection(db, "unavailableDays"), orderBy("date"));
            unavailUnsub = onSnapshot(q, (snap) => {
                const next = new Map();
                snap.forEach((d) => {
                    const x = d.data() || {};
                    const date = String(x.date || "");
                    const emp = x.employeeId == null ? "all" : String(x.employeeId);
                    if (!date) return;
                    if (!next.has(date)) next.set(date, new Set());
                    next.get(date).add(emp);
                });
                unavailMap = next;

                // Re-evaluate calendar/time availability
                renderCalendar();
                buildTimeOptionsDynamic(true, true);
            });
        } catch {
            // ignore
        }
    }

    // ========= Small helpers =========
    const escapeHtml = (str) =>
        String(str).replace(/[&<>"']/g, (s) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        }[s]));

    function scrollToTopSmooth() {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
    function scrollToTopInstant() {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    // ========= Time helpers =========
    function timeToMinutes(hhmm) {
        const [h, m] = hhmm.split(":").map(Number);
        return h * 60 + m;
    }
    function minutesToTime(mins) {
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    }
    function addMinutesToTime(timeHHMM, minutesToAdd) {
        if (!timeHHMM || minutesToAdd == null) return "";
        const total = timeToMinutes(timeHHMM) + Number(minutesToAdd);
        return minutesToTime(total);
    }

    // ========= Auth + Firestore helpers =========
    function setAuthMessage(msg, isError = true) {
        if (!authMsg) return;
        authMsg.className = isError ? "form-error" : "form-success";
        authMsg.textContent = msg || "";
    }

    async function loadMyAppointments() {
        if (!currentUser) {
            apptCache = [];
            return;
        }

        const q = query(collection(db, "appointments"), where("userId", "==", currentUser.uid));
        const snap = await getDocs(q);
        apptCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        apptCache.sort((a, b) => {
            const ta = a?.createdAt?.toMillis ? a.createdAt.toMillis() : Date.parse(a?.createdAt || 0) || 0;
            const tb = b?.createdAt?.toMillis ? b.createdAt.toMillis() : Date.parse(b?.createdAt || 0) || 0;
            return tb - ta;
        });
    }

    async function deleteMyAppointmentById(id) {
        if (!currentUser || !id) return;

        let apptData = null;
        let lockId = "";
        try {
            const snap = await getDoc(doc(db, "appointments", id));
            if (snap.exists()) {
                apptData = snap.data() || null;
                lockId = apptData?.lockId || "";
            }
        } catch { }

        try {
            await deleteScheduledBrevoEmail(apptData?.reminderMessageId || "");
        } catch (err) {
            console.warn("⚠️ Could not delete scheduled reminder:", err);
        }

        await deleteDoc(doc(db, "appointments", id));

        if (lockId) {
            try {
                await deleteDoc(doc(db, "slotLocks", lockId));
            } catch { }
        }

        if (apptData?.email) {
            try {
                await sendCancellationEmail({
                    name: apptData.name || "",
                    email: apptData.email || "",
                    serviceName: (String(apptData.lang || "en").startsWith("fr") ? apptData.serviceNameFr : apptData.serviceNameEn) || apptData.serviceNameEn || apptData.serviceNameFr || apptData.serviceId || (TT("appoint.serviceLabel") || "Service"),
                    date: apptData.date || "",
                    startTime: apptData.time || "",
                    endTime: apptData.endTime || (apptData.duration ? addMinutesToTime(apptData.time || "", apptData.duration) : (apptData.time || "")),
                    dresser: apptData.dresserName || (Array.isArray(apptData.dresserNames) ? apptData.dresserNames.join(", ") : ""),
                    lang: apptData.lang || currentLang(),
                    cancelledBy: "client",
                });
            } catch (err) {
                console.error("❌ Cancellation email failed:", err);
            }
        }

        await loadMyAppointments();
    }

    async function clearMyAppointments() {
        if (!currentUser) return;

        const q = query(collection(db, "appointments"), where("userId", "==", currentUser.uid));
        const snap = await getDocs(q);

        for (const d of snap.docs) {
            const data = d.data() || {};
            try {
                await deleteScheduledBrevoEmail(data?.reminderMessageId || "");
            } catch (err) {
                console.warn("⚠️ Could not delete scheduled reminder:", err);
            }
            await deleteDoc(doc(db, "appointments", d.id));
            if (data.lockId) {
                try {
                    await deleteDoc(doc(db, "slotLocks", data.lockId));
                } catch { }
            }
            if (data.email) {
                try {
                    await sendCancellationEmail({
                        name: data.name || "",
                        email: data.email || "",
                        serviceName: (String(data.lang || "en").startsWith("fr") ? data.serviceNameFr : data.serviceNameEn) || data.serviceNameEn || data.serviceNameFr || data.serviceId || (TT("appoint.serviceLabel") || "Service"),
                        date: data.date || "",
                        startTime: data.time || "",
                        endTime: data.endTime || (data.duration ? addMinutesToTime(data.time || "", data.duration) : (data.time || "")),
                        dresser: data.dresserName || (Array.isArray(data.dresserNames) ? data.dresserNames.join(", ") : ""),
                        lang: data.lang || currentLang(),
                        cancelledBy: "client",
                    });
                } catch (err) {
                    console.error("❌ Cancellation email failed:", err);
                }
            }
        }

        await loadMyAppointments();
    }

    // ========= Auth buttons =========
    btnSignup?.addEventListener("click", async () => {
        setAuthMessage("");
        try {
            const email = (authEmail?.value || "").trim();
            const pass = authPass?.value || "";
            if (!email || !pass) {
                setAuthMessage("Enter an email and password.");
                return;
            }
            await createUserWithEmailAndPassword(auth, email, pass);
            setAuthMessage("Account created. You’re logged in.", false);
        } catch (e) {
            setAuthMessage(e?.message || "Signup failed.");
        }
    });

    btnLogin?.addEventListener("click", async () => {
        setAuthMessage("");
        try {
            const email = (authEmail?.value || "").trim();
            const pass = authPass?.value || "";
            if (!email || !pass) {
                setAuthMessage("Enter an email and password.");
                return;
            }
            await signInWithEmailAndPassword(auth, email, pass);
            setAuthMessage("Logged in.", false);
        } catch (e) {
            setAuthMessage(e?.message || "Login failed.");
        }
    });

    btnLogout?.addEventListener("click", async () => {
        await signOut(auth);
    });

    // ========= Calendar invite helpers =========
    function pad2(n) {
        return String(n).padStart(2, "0");
    }
    function formatLocalIcsDateTime(dateISO, timeHHMM) {
        const [y, m, d] = dateISO.split("-").map(Number);
        const [hh, mm] = timeHHMM.split(":").map(Number);
        return `${y}${pad2(m)}${pad2(d)}T${pad2(hh)}${pad2(mm)}00`;
    }

    function buildGoogleCalendarLink({ title, description, location, date, startTime, endTime }) {
        const start = formatLocalIcsDateTime(date, startTime);
        const end = formatLocalIcsDateTime(date, endTime);
        const params = new URLSearchParams({
            action: "TEMPLATE",
            text: title,
            details: description,
            location: location,
            dates: `${start}/${end}`,
        });
        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }

    function buildOutlookCalendarLink({ title, description, location, date, startTime, endTime }) {
        const startISO = `${date}T${startTime}:00`;
        const endISO = `${date}T${endTime}:00`;
        const formattedDescription = String(description || "").replace(/\n/g, "\r\n");

        const params = new URLSearchParams({
            path: "/calendar/action/compose",
            rru: "addevent",
            subject: title,
            body: formattedDescription,
            location: location,
            startdt: startISO,
            enddt: endISO,
        });

        return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
    }

    // ========= Employees (NO DEFAULTS) =========
    const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    function getEmployees() {
        if (Array.isArray(employeesCache) && employeesCache.length) return employeesCache;

        const data = JSON.parse(localStorage.getItem(EMP_KEY) || "[]");
        return Array.isArray(data) ? data.map((e) => ({ ...e, id: e.id || e.name })) : [];
    }

    function stopEmployeesListener() {
        if (typeof employeesUnsub === "function") {
            try {
                employeesUnsub();
            } catch { }
        }
        employeesUnsub = null;
    }

    function startEmployeesListener() {
        stopEmployeesListener();

        try {
            employeesUnsub = onSnapshot(
                collection(db, "employees"),
                (snap) => {
                    const next = [];
                    snap.forEach((d) => {
                        const data = d.data() || {};
                        if (data && typeof data.name === "string" && data.name.trim()) {
                            next.push({ id: d.id, ...data, name: data.name.trim() });
                        }
                    });
                    next.sort((a, b) => String(a.name).localeCompare(String(b.name)));
                    employeesCache = next;

                    renderDresserCheckboxes();
                    setupDresserSelectAll();
                    setBookingVisibility();
                    renderCalendar();
                    buildTimeOptionsDynamic(true);
                },
                (err) => {
                    console.warn("⚠️ employees listener error (using localStorage fallback):", err);
                    employeesCache = [];
                    renderDresserCheckboxes();
                    setupDresserSelectAll();
                    setBookingVisibility();
                    renderCalendar();
                    buildTimeOptionsDynamic(true);
                }
            );
        } catch (e) {
            console.warn("⚠️ employees listener setup failed (using localStorage fallback):", e);
            employeesCache = [];
        }
    }

    function getDayKeyFromISODate(iso) {
        if (!iso) return null;
        const [y, m, d] = iso.split("-").map(Number);
        if (!y || !m || !d) return null;
        const date = new Date(y, m - 1, d);
        return DAY_KEYS[date.getDay()];
    }

    function getWorkingWindow(emp, isoDate) {
        const dayKey = getDayKeyFromISODate(isoDate);
        if (!dayKey || !emp) return null;

        if (emp.schedule) {
            const s = emp.schedule[dayKey];
            if (!s || !s.on) return null;
            if (!s.start || !s.end) return null;
            return { start: s.start, end: s.end };
        }

        // backward compat only
        if (emp.start && emp.end) return { start: emp.start, end: emp.end };
        return null;
    }

    // ========= Gate: show calendar + date/time ONLY if service + stylist chosen =========
    function hasServiceSelected() {
        return !!(serviceSelect.value || "").trim();
    }

    function hasStylistSelection() {
        const anyBox = $("dresser-any");
        if (anyBox && anyBox.checked) return true;
        return document.querySelectorAll(".dresser-check:checked").length > 0;
    }

    function shouldShowBooking() {
        return hasServiceSelected() && hasStylistSelection();
    }

    // ========= Calendar state =========
    let calCursor = (() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    })();

    let slotMapForSelectedDate = new Map(); // time -> [employeeId]

    function clearSelectedDateAndTimes(preserveSelection = false) {
        const prevSelected = preserveSelection ? (timeSelect.value || "") : "";

        dateInput.value = "";
        slotMapForSelectedDate = new Map();

        while (timeSelect.options.length > 1) timeSelect.remove(1);
        timeSelect.value = "";

        // ✅ Dark/disabled until a date is chosen
        timeSelect.disabled = true;

        if (timeHintEl) timeHintEl.textContent = "";

        if (prevSelected) timeSelect.dataset.prevSelected = prevSelected;
        else delete timeSelect.dataset.prevSelected;
    }

    function setBookingVisibility() {
        const show = shouldShowBooking();

        calendarEl.style.display = show ? "" : "none";
        if (bookingRow) bookingRow.style.display = show ? "flex" : "none";

        dateInput.disabled = !show;

        // ✅ time is ONLY enabled once a date is selected
        timeSelect.disabled = !show || !(dateInput.value || "").trim();

        if (!show) {
            clearSelectedDateAndTimes(false);
            stopLockListener();
        } else {
            // If shown but no date yet, give hint + keep disabled
            if (!dateInput.value) {
                if (timeHintEl) timeHintEl.textContent = TT("appoint.pickDayTimes");
                timeSelect.disabled = true;
            }
        }
    }

    function isoFromDateParts(y, mIndex, d) {
        const mm = String(mIndex + 1).padStart(2, "0");
        const dd = String(d).padStart(2, "0");
        return `${y}-${mm}-${dd}`;
    }

    function toISODate(dateObj) {
        const y = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
        const dd = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${mm}-${dd}`;
    }

    function getServiceDuration() {
        const s = getServiceById(serviceSelect.value || "");
        return s?.duration ?? 0;
    }

    function slotConflicts(date, startTime, durationMinutes, selectedEmployees) {
        const appts = getAppointments().filter((a) => a.date === date);
        if (!appts.length) return false;

        const slotStart = timeToMinutes(startTime);
        const slotEnd = slotStart + (durationMinutes || 0);

        const selectedIds = new Set(selectedEmployees.map((e) => e.id));
        const selectedNames = new Set(selectedEmployees.map((e) => e.name));

        return appts.some((a) => {
            const apptDressers = a.dressers || [];
            const overlapsSelected = apptDressers.some((d) => selectedIds.has(d) || selectedNames.has(d));
            if (!overlapsSelected) return false;

            const aStart = timeToMinutes(a.time);
            const aEnd = a.endTime ? timeToMinutes(a.endTime) : aStart;

            return slotStart < aEnd && aStart < slotEnd;
        });
    }

    function getSelectedEmployeesForAvailability() {
        const employees = getEmployees();
        const anyBox = $("dresser-any");
        if (!employees.length) return [];

        if (anyBox && anyBox.checked) return employees;

        const selectedIds = Array.from(document.querySelectorAll(".dresser-check:checked")).map(
            (cb) => cb.value
        );

        if (!selectedIds.length) return employees;
        return employees.filter((e) => selectedIds.includes(e.id));
    }

    function getSlotMapForDate(isoDate, durationMinutes, employeesPool) {
        const STEP = 30;
        const map = new Map();

        (employeesPool || []).forEach((emp) => {
            const win = getWorkingWindow(emp, isoDate);
            if (!win) return;

            const startMin = timeToMinutes(win.start);
            const endMin = timeToMinutes(win.end);
            const lastStart = endMin - durationMinutes;
            if (lastStart < startMin) return;

            // Prevent showing past time slots for today
            const todayIso = toISODate(new Date());
            let minStart = startMin;

            if (isoDate === todayIso) {
                const now = new Date();
                const nowMin = now.getHours() * 60 + now.getMinutes();
                const rounded = Math.ceil(nowMin / STEP) * STEP;
                minStart = Math.max(minStart, rounded);
                if (minStart > lastStart) return;
            }

            for (let t = minStart; t <= lastStart; t += STEP) {
                const hhmm = minutesToTime(t);
                if (durationMinutes && slotConflicts(isoDate, hhmm, durationMinutes, [emp])) continue;

                if (!map.has(hhmm)) map.set(hhmm, []);
                map.get(hhmm).push(emp.id);
            }
        });

        return map;
    }

    function renderCalendar() {
        if (!shouldShowBooking()) {
            calendarEl.style.display = "none";
            return;
        }

        calendarEl.style.display = "";

        const employees = getEmployees();
        if (!employees.length) {
            calendarEl.innerHTML = `
        <div class="cal-head">
          <div class="cal-title">${escapeHtml(TT("appoint.noStylistsTitle"))}</div>
        </div>
      `;
            return;
        }

        if (!hasServiceSelected()) {
            calendarEl.innerHTML = `
        <div class="cal-head">
          <div class="cal-title">${escapeHtml(TT("appoint.selectServiceDays"))}</div>
        </div>
      `;
            return;
        }

        const duration = getServiceDuration();
        const employeesPool = getSelectedEmployeesForAvailability();
        const poolIds = employeesPool.map((e) => e.id);

        const year = calCursor.getFullYear();
        const monthIndex = calCursor.getMonth();

        const firstDay = new Date(year, monthIndex, 1);
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        const startDow = firstDay.getDay();

        const lang = document.documentElement.lang || "en";
        const monthName = firstDay.toLocaleString(lang, { month: "long", year: "numeric" });

        const availableIsoDays = new Set();
        const todayIso = toISODate(new Date());

        for (let d = 1; d <= daysInMonth; d++) {
            const iso = isoFromDateParts(year, monthIndex, d);
            if (iso < todayIso) continue; // ✅ today forward only
            if (isDateBlocked(iso, poolIds)) continue; // ✅ blocked day (shop closed / stylist off)
            const map = getSlotMapForDate(iso, duration, employeesPool);
            if (map.size > 0) availableIsoDays.add(iso);
        }

        const now = new Date();
        now.setDate(1);
        now.setHours(0, 0, 0, 0);
        const isPrevDisabled = calCursor.getTime() <= now.getTime();

        const dows = ["S", "M", "T", "W", "T", "F", "S"];
        const selectedIso = dateInput.value || "";

        let grid = "";
        dows.forEach((d) => (grid += `<div class="cal-dow">${d}</div>`));

        for (let i = 0; i < startDow; i++) {
            grid += `<button type="button" class="cal-day is-empty" tabindex="-1" aria-hidden="true"></button>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const iso = isoFromDateParts(year, monthIndex, d);
            const isAvailable = availableIsoDays.has(iso);
            const isSelected = selectedIso === iso;

            const cls = ["cal-day", isSelected ? "is-selected" : "", !isAvailable ? "is-disabled" : ""]
                .filter(Boolean)
                .join(" ");

            grid += `
        <button type="button" class="${cls}" data-iso="${iso}" ${isAvailable ? "" : "disabled"}>
          ${d}
          ${isAvailable ? '<span class="dot" aria-hidden="true"></span>' : ""}
        </button>
      `;
        }

        calendarEl.innerHTML = `
      <div class="cal-head">
        <div class="cal-title">${escapeHtml(monthName)}</div>
        <div class="cal-nav">
          <button type="button" class="cal-btn" id="cal-prev" ${isPrevDisabled ? "disabled" : ""
            } aria-label="${escapeHtml(TT("calendar.monthAriaPrev"))}">&#8249;</button>
          <button type="button" class="cal-btn" id="cal-next" aria-label="${escapeHtml(
                TT("calendar.monthAriaNext")
            )}">&#8250;</button>
        </div>
      </div>
      <div class="cal-grid">${grid}</div>
    `;

        calendarEl.querySelector("#cal-prev")?.addEventListener("click", () => {
            if (isPrevDisabled) return;
            calCursor = new Date(year, monthIndex - 1, 1);
            renderCalendar();
        });

        calendarEl.querySelector("#cal-next")?.addEventListener("click", () => {
            calCursor = new Date(year, monthIndex + 1, 1);
            renderCalendar();
        });

        calendarEl.querySelectorAll(".cal-day[data-iso]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const iso = btn.getAttribute("data-iso") || "";
                if (!iso) return;

                dateInput.value = iso;

                // ✅ enable now that date is selected
                timeSelect.disabled = false;

                slotMapForSelectedDate = getSlotMapForDate(iso, duration, employeesPool);
                buildTimeOptionsDynamic();
                renderCalendar();
            });
        });
    }

    function buildTimeOptionsDynamic(preserveSelection = false, skipLockListener = false) {
        if (!shouldShowBooking()) return;

        const prevSelected = preserveSelection
            ? timeSelect.value || timeSelect.dataset.prevSelected || ""
            : "";

        if (timeSelect.dataset.prevSelected) delete timeSelect.dataset.prevSelected;

        const date = dateInput.value || "";
        const serviceId = (serviceSelect.value || "").trim();
        const duration = getServiceDuration();

        while (timeSelect.options.length > 1) timeSelect.remove(1);
        timeSelect.value = "";

        if (!serviceId) {
            stopLockListener();
            timeSelect.disabled = true;
            return;
        }

        if (!date) {
            stopLockListener();
            // ✅ keep disabled + darker until date chosen
            timeSelect.disabled = true;
            if (timeHintEl) timeHintEl.textContent = TT("appoint.pickDayTimes");
            return;
        }

        // ✅ date selected => enable
        timeSelect.disabled = false;

        const selectedPool = getSelectedEmployeesForAvailability();

        // ✅ if this day is blocked (shop closed / stylist off), show no times
        const poolIds = selectedPool.map((e) => e.id);
        if (isDateBlocked(date, poolIds)) {
            stopLockListener();
            timeSelect.disabled = true;
            if (timeHintEl) timeHintEl.textContent = TT("appoint.dayBlocked") || "This day is not available.";
            return;
        }

        if (!skipLockListener) startLockListener(date, selectedPool);

        slotMapForSelectedDate = getSlotMapForDate(date, duration, selectedPool);

        // remove locked employees from each time
        for (const [t0, ids] of Array.from(slotMapForSelectedDate.entries())) {
            const filtered = (ids || []).filter((empId) => !isLocked(empId, date, t0));
            if (!filtered.length) slotMapForSelectedDate.delete(t0);
            else slotMapForSelectedDate.set(t0, filtered);
        }

        const sorted = Array.from(slotMapForSelectedDate.keys()).sort(
            (a, b) => timeToMinutes(a) - timeToMinutes(b)
        );

        sorted.forEach((t0) => {
            const opt = document.createElement("option");
            opt.value = t0;
            opt.textContent = t0;
            timeSelect.appendChild(opt);
        });

        if (prevSelected && sorted.includes(prevSelected)) {
            timeSelect.value = prevSelected;
        }

        if (timeHintEl) {
            timeHintEl.textContent = sorted.length ? TT("appoint.times30") : TT("appoint.noTimes");
        }
    }

    // ========= Tooltip schedule =========
    function formatScheduleForTooltip(emp) {
        const days = [
            ["mon", TT("appoint.dayMon")],
            ["tue", TT("appoint.dayTue")],
            ["wed", TT("appoint.dayWed")],
            ["thu", TT("appoint.dayThu")],
            ["fri", TT("appoint.dayFri")],
            ["sat", TT("appoint.daySat")],
            ["sun", TT("appoint.daySun")],
        ];

        if (!emp.schedule) {
            return `<div style="opacity:.8">${escapeHtml(TT("appoint.hoursNotSet"))}</div>`;
        }

        const closedTxt = TT("appoint.hoursClosed");

        const rows = days
            .map(([key, label]) => {
                const s = emp.schedule[key];
                if (!s || !s.on) {
                    return `
            <div class="hours-day">${escapeHtml(label)}</div>
            <div class="hours-time hours-closed">${escapeHtml(closedTxt)}</div>
          `;
                }
                return `
          <div class="hours-day">${escapeHtml(label)}</div>
          <div class="hours-time">${escapeHtml(s.start)} – ${escapeHtml(s.end)}</div>
        `;
            })
            .join("");

        return `<div class="hours-grid">${rows}</div>`;
    }

    // ========= Stylists UI =========
    function renderDresserCheckboxes() {
        const box = $("dresser-box");
        const employees = getEmployees();
        if (!box) return;

        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');

        if (!employees.length) {
            box.innerHTML = `
        <div class="dresser-empty">
          <p style="opacity:.85; margin:0;">${escapeHtml(TT("appoint.noStylists"))}</p>
        </div>
      `;
            if (submitBtn) submitBtn.disabled = true;
            return;
        }

        if (submitBtn) submitBtn.disabled = false;

        box.innerHTML = `
      <div class="dresser-row dresser-any-row">
        <label class="dresser-item dresser-any">
          <input type="checkbox" id="dresser-any" />
          <span>${escapeHtml(TT("appoint.any"))}</span>
        </label>
      </div>

      <div class="dresser-row">
        ${employees
                .map((e) => {
                    const safeName = escapeHtml(e.name);
                    const safeId = escapeHtml(e.id);
                    const tooltipHtml = formatScheduleForTooltip(e);

                    return `
              <label class="dresser-item">
                <input type="checkbox" class="dresser-check" value="${safeId}" />
                <span class="emp-label">
                  <span class="emp-name">${safeName}</span>
                  <span class="emp-info" aria-label="Info">
                    i
                    <span class="emp-tooltip">
                      <strong>${safeName} — ${escapeHtml(TT("appoint.hoursTitle"))}</strong>
                      ${tooltipHtml}
                    </span>
                  </span>
                </span>
              </label>
            `;
                })
                .join("")}
      </div>
    `;
    }

    function resetDresserUI() {
        const anyBox = $("dresser-any");
        const stylists = Array.from(document.querySelectorAll(".dresser-check"));
        if (anyBox) anyBox.checked = false;
        stylists.forEach((cb) => {
            cb.checked = false;
            cb.disabled = false;
        });
    }

    function setupDresserSelectAll() {
        const anyBox = $("dresser-any");
        const stylists = Array.from(document.querySelectorAll(".dresser-check"));
        if (!anyBox || !stylists.length) return;

        anyBox.addEventListener("change", () => {
            if (anyBox.checked) {
                stylists.forEach((cb) => {
                    cb.checked = false;
                    cb.disabled = true;
                });
            } else {
                stylists.forEach((cb) => (cb.disabled = false));
            }

            setBookingVisibility();
            if (shouldShowBooking()) {
                clearSelectedDateAndTimes(false);
                renderCalendar();
            }
        });

        stylists.forEach((cb) => {
            cb.addEventListener("change", () => {
                if (cb.checked) {
                    anyBox.checked = false;
                    stylists.forEach((x) => (x.disabled = false));
                }

                setBookingVisibility();
                if (shouldShowBooking()) {
                    clearSelectedDateAndTimes(false);
                    renderCalendar();
                }
            });
        });
    }

    // ========= Saved appointments =========
    function getServiceLabelFromAppointment(a) {
        if (a.serviceId) {
            const s = getServiceById(a.serviceId);
            if (s) return getServiceDisplayName(s);
        }

        if (a.service && (a.service.startsWith("appoint.services.") || a.service.startsWith("services."))) {
            return TT(a.service);
        }

        return a.serviceLabel || a.service || "Service";
    }


    function getAppointmentDateTime(a) {
        const date = String(a?.date || "").trim();
        const time = String(a?.endTime || a?.time || "").trim();
        if (!date || !time) return null;
        const dt = new Date(`${date}T${time}:00`);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function isPastAppointment(a) {
        const dt = getAppointmentDateTime(a);
        if (!dt) return false;
        return dt.getTime() < Date.now();
    }

    function getUpcomingAppointments() {
        return getAppointments()
            .filter((a) => !isPastAppointment(a))
            .slice()
            .sort((a, b) => {
                const ta = getAppointmentDateTime(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                const tb = getAppointmentDateTime(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
                return ta - tb;
            });
    }

    function getPastAppointments() {
        return getAppointments()
            .filter((a) => isPastAppointment(a))
            .slice()
            .sort((a, b) => {
                const ta = getAppointmentDateTime(a)?.getTime() ?? 0;
                const tb = getAppointmentDateTime(b)?.getTime() ?? 0;
                return tb - ta;
            });
    }

    function renderAppointmentCards(items, { emptyText = "", includeRemove = true } = {}) {
        if (!items.length) {
            return `<div class="appoint-meta">${escapeHtml(emptyText)}</div>`;
        }

        return items
            .map((a) => {
                const serviceLine = getServiceLabelFromAppointment(a);
                const dur = a.duration ? ` (${a.duration}min)` : "";
                const cost = a.price !== null && a.price !== undefined && a.price !== "" ? ` (${a.price}$)` : "";
                const end = a.endTime ? ` – ${escapeHtml(a.endTime)}` : "";
                const removeBtnHtml = includeRemove
                    ? `<button class="btn ghost danger appoint-remove" data-id="${escapeHtml(a.id)}" type="button">${escapeHtml(TT("appoint.removeBtn"))}</button>`
                    : "";

                return `
          <div class="appoint-item">
            <div>
              <strong>${escapeHtml(serviceLine)}${dur}${cost} — ${escapeHtml(
                    formatDateLong(a.date)
                )} ${escapeHtml(a.time)}${end}</strong>
              <div class="appoint-meta">${escapeHtml(TT("appoint.hairdresserPrefix"))} ${escapeHtml(
                    a.dresserName || (a.dressers || []).join(", ")
                )}</div>
              <div class="appoint-meta">${(() => { const parts = [a.name, a.email, a.phone].filter(v => v && String(v).trim()); return parts.map(p => escapeHtml(p)).join(" • "); })()}</div>
              ${a.notes ? `<div class="appoint-meta">${escapeHtml(a.notes)}</div>` : ""}
            </div>
            ${removeBtnHtml}
          </div>
        `;
            })
            .join("");
    }

    function wireRemoveButtons(scopeEl) {
        scopeEl.querySelectorAll(".appoint-remove").forEach((btn) => {
            btn.addEventListener("click", async () => {
                if (!(await askCancelAppointment())) return;

                const id = btn.dataset.id;
                await deleteMyAppointmentById(id);

                renderAppointments();
                renderPastAppointmentsModal();
                clearSelectedDateAndTimes(false);
                renderCalendar();
                setBookingVisibility();
            });
        });
    }

    function renderPastAppointmentsModal() {
        if (!currentUser) {
            pastListEl.innerHTML = `<div class="appoint-meta">${escapeHtml(TT("appoint.loginToManage"))}</div>`;
            return;
        }

        const pastItems = getPastAppointments();
        pastListEl.innerHTML = renderAppointmentCards(pastItems, {
            emptyText: TT("appoint.noPast"),
            includeRemove: false,
        });
    }

    function openPastAppointmentsModal() {
        renderPastAppointmentsModal();
        pastOverlay.style.display = "flex";
        document.body.classList.add("modal-open");
    }

    function closePastAppointmentsModal() {
        pastOverlay.style.display = "none";
        document.body.classList.remove("modal-open");
    }

    function renderAppointments() {
        const items = getUpcomingAppointments();

        if (!currentUser) {
            listEl.innerHTML = `<div class="appoint-meta">${escapeHtml(TT("appoint.loginToManage"))}</div>`;
            return;
        }

        listEl.innerHTML = renderAppointmentCards(items, {
            emptyText: TT("appoint.noUpcoming"),
            includeRemove: true,
        });

        wireRemoveButtons(listEl);
    }

    // ========= Email sending (Brevo API) =========
    function buildConfirmationEmailHtml({
        name,
        serviceName,
        dateFormatted,
        timeRange,
        dresser,
        notes,
        cancelUrl,
        cal_google,
        cal_outlook,
        cal_ics,
        email_preview,
        E,
        lang = currentLang(),
    }) {
        const notesBlock = notes
            ? `
    <div style="margin:14px 0 0 0;">
      <p style="margin:0 0 14px 0;">
        <strong>${escapeHtml(E.clientNotes)}</strong><br/>
        ${escapeHtml(notes)}
      </p>
    </div>`
            : "";

        return `<!doctype html>
<html lang="${String(lang).startsWith("fr") ? "fr" : "en"}">
<body>
  <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(email_preview)}</div>
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size:14px; line-height:1.5; color:#fff; background-color:#333; padding:24px 12px; margin:0;">
    <div style="max-width:600px; margin:0 auto; background-color:#333; padding:16px 18px;">

      <div style="border-top:6px solid #458500; padding:16px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:10px; vertical-align:middle;">
              <img
                src="https://i.postimg.cc/N009YmbD/logo-modified.png"
                alt="UBarbershop"
                width="35"
                height="35"
                style="display:block;width:35px;height:35px;border:0;outline:none;text-decoration:none;"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:16px; font-weight:700; color:#fff;">
                ${escapeHtml(E.thankYou)}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 10px 0;">${escapeHtml(name)},</p>
      <p style="margin:0 0 14px 0;">${escapeHtml(E.confirmed)}</p>

      <div style="margin:14px 0; padding:12px 0; border-top:1px solid rgba(255,255,255,.25); border-bottom:1px solid rgba(255,255,255,.25);">
        <p style="margin:0;">
          <strong>${escapeHtml(serviceName)}</strong> ${escapeHtml(E.with)} <strong>${escapeHtml(dresser)}</strong><br/>
          ${escapeHtml(dateFormatted)}, ${escapeHtml(timeRange)}
        </p>
      </div>${notesBlock}

      <div style="margin:14px 0 0 0;">
        <p style="margin:0 0 10px 0;"><strong>${escapeHtml(E.addToCalendar)}</strong></p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:10px; padding-bottom:10px;">
              <a href="${escapeHtml(cal_google)}" target="_blank"
                 style="background:#458500; color:#fff; text-decoration:none; padding:10px 12px; border-radius:8px; display:inline-block; font-size:12px;">
                ${escapeHtml(E.btnGoogle)}
              </a>
            </td>
            <td style="padding-right:10px; padding-bottom:10px;">
              <a href="${escapeHtml(cal_outlook)}" target="_blank"
                 style="background:#222; color:#fff; text-decoration:none; padding:10px 12px; border-radius:8px; display:inline-block; border:1px solid rgba(255,255,255,.25); font-size:12px;">
                ${escapeHtml(E.btnOutlook)}
              </a>
            </td>
            <td style="padding-bottom:10px;">
              <a href="${escapeHtml(cal_ics)}" target="_blank"
                 style="background:#444; color:#fff; text-decoration:none; padding:10px 12px; border-radius:8px; display:inline-block; border:1px solid rgba(255,255,255,.25); font-size:12px;">
                ${escapeHtml(E.btnIphone)}
              </a>
            </td>
          </tr>
        </table>

        <p style="margin:6px 0 0 0; opacity:.85; font-size:12px;">
          ${escapeHtml(E.tip)}
        </p>
      </div>

      <br/>

      <p style="margin:0 0 14px 0;">
        ${escapeHtml(E.cancelText)}
        <a href="${escapeHtml(cancelUrl)}" target="_blank" style="color:#458500; text-decoration:none; font-weight:500;">
          ${escapeHtml(E.clickHere)}
        </a>.
      </p>

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

    function buildReminderEmailHtml({
        name,
        serviceName,
        dateFormatted,
        timeRange,
        dresser,
        notes,
        email_preview,
        E,
        lang = currentLang(),
    }) {
        const notesBlock = notes
            ? `
    <div style="margin:14px 0 0 0;">
      <p style="margin:0 0 14px 0;">
        <strong>${escapeHtml(E.clientNotes)}</strong><br/>
        ${escapeHtml(notes)}
      </p>
    </div>`
            : "";

        return `<!doctype html>
<html lang="${String(lang).startsWith("fr") ? "fr" : "en"}">
<body>
  <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(email_preview)}</div>
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size:14px; line-height:1.5; color:#fff; background-color:#333; padding:24px 12px; margin:0;">
    <div style="max-width:600px; margin:0 auto; background-color:#333; padding:16px 18px;">

      <div style="border-top:6px solid #458500; padding:16px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:10px; vertical-align:middle;">
              <img
                src="https://i.postimg.cc/N009YmbD/logo-modified.png"
                alt="UBarbershop"
                width="35"
                height="35"
                style="display:block;width:35px;height:35px;border:0;outline:none;text-decoration:none;"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:16px; font-weight:700; color:#fff;">
                ${escapeHtml(E.reminderTitle)}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 10px 0;">${escapeHtml(name)},</p>
      <p style="margin:0 0 14px 0;">${escapeHtml(E.reminderIntro)}</p>

      <div style="margin:14px 0; padding:12px 0; border-top:1px solid rgba(255,255,255,.25); border-bottom:1px solid rgba(255,255,255,.25);">
        <p style="margin:0;">
          <strong>${escapeHtml(serviceName)}</strong> ${escapeHtml(E.with)} <strong>${escapeHtml(dresser)}</strong><br/>
          ${escapeHtml(dateFormatted)}, ${escapeHtml(timeRange)}
        </p>
      </div>${notesBlock}

      <br/>

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

    function TT_LANG(langCode, path, vars) {
        if (window.tLang) {
            return window.tLang(
                String(langCode || "en").startsWith("fr") ? "fr" : "en",
                path,
                vars
            );
        }
        return TT(path, vars);
    }

    function buildCancellationEmailHtml({ name, serviceName, dateFormatted, timeRange, dresser, lang, cancelledBy }) {
        const isFr = String(lang || currentLang()).startsWith("fr");
        const E = {
            title: TT_LANG(lang, "appoint.email.cancelledTitle"),
            intro: TT_LANG(lang, cancelledBy === "salon" ? "appoint.email.cancelledSalonIntro" : "appoint.email.cancelledClientIntro"),
            with: TT_LANG(lang, "appoint.email.with"),
            thanks: TT_LANG(lang, "appoint.email.thanks"),
            shopPhoneLabel: TT_LANG(lang, "appoint.email.shopPhoneLabel") || (isFr ? "Téléphone" : "Phone"),
            cancelledByLabel: TT_LANG(lang, cancelledBy === "salon" ? "appoint.email.cancelledBySalonLabel" : "appoint.email.cancelledByClientLabel"),
        };

        return `<!DOCTYPE html>
<html lang="${isFr ? "fr" : "en"}">
<body>
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; font-size:14px; line-height:1.5; color:#fff; background-color:#333; padding:24px 12px; margin:0;">
    <div style="max-width:600px; margin:0 auto; background-color:#333; padding:16px 18px;">

      <div style="border-top:6px solid #b91c1c; padding:16px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding-right:10px; vertical-align:middle;">
              <img
                src="https://i.postimg.cc/N009YmbD/logo-modified.png"
                alt="UBarbershop"
                width="35"
                height="35"
                style="display:block;width:35px;height:35px;border:0;outline:none;text-decoration:none;"
              />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:16px; font-weight:700; color:#fff;">${escapeHtml(E.title)}</span>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 10px 0;">${escapeHtml(name)},</p>
      <p style="margin:0 0 14px 0;">${escapeHtml(E.intro)}</p>

      <div style="margin:14px 0; padding:12px 0; border-top:1px solid rgba(255,255,255,.25); border-bottom:1px solid rgba(255,255,255,.25);">
        <p style="margin:0;">
          <strong>${escapeHtml(serviceName)}</strong> ${escapeHtml(E.with)} <strong>${escapeHtml(dresser)}</strong><br/>
          ${escapeHtml(dateFormatted)}, ${escapeHtml(timeRange)}
        </p>
      </div>

      <p style="margin:0 0 14px 0; opacity:.92;">${escapeHtml(E.cancelledByLabel)}</p>

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

    async function sendCancellationEmail({ name, email, serviceName, date, startTime, endTime, dresser, lang, cancelledBy = "client" }) {
        if (!email) return { skipped: true };

        const isFr = String(lang || currentLang()).startsWith("fr");
        const email_subject = TT_LANG(lang, "appoint.email.cancelledSubject");
        const email_preview = TT_LANG(
            lang,
            "appoint.email.cancelledPreview",
            isFr ? "Votre rendez-vous chez UBarbershop a été annulé." : "Your appointment at UBarbershop has been cancelled."
        );
        const dateFormatted = formatDateLong(date);
        const timeRange = `${startTime} – ${endTime}`;
        const htmlContent = buildCancellationEmailHtml({
            name,
            serviceName,
            dateFormatted,
            timeRange,
            dresser,
            lang,
            cancelledBy,
        }).replace(
            '<body>',
            `<body>
  <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(email_preview)}</div>`
        );

        const payload = {
            sender: {
                name: BREVO_CONFIG.senderName || "UBarbershop",
                email: BREVO_CONFIG.senderEmail || "ubarbershop2023@gmail.com",
            },
            replyTo: {
                email: "noreply@ubarbershop.ca",
                name: "UBarbershop"
            },
            to: [{ email, name }],
            subject: email_subject,
            htmlContent,
        };

        return sendBrevoEmail(payload);
    }

    async function sendConfirmationEmail({ name, email, serviceName, date, startTime, endTime, dresser, notes, lang, appointmentId }) {
        if (!email) return { skipped: true };

        const safeNotes = (notes || "").trim() || "—";
        const isFr = String(lang || currentLang()).startsWith("fr");
        const email_subject = TT_LANG(lang, "appoint.email.subject");
        const email_preview = TT_LANG(lang, "appoint.email.preview");

        const title = `UBarbershop – ${serviceName}`;
        const location = "771A Arthur-Sauvé, Saint-Eustache, QC, Canada, J7R 4K3";

        const L = {
            client: TT("appoint.cal.client"),
            service: TT("appoint.cal.service"),
            barber: TT("appoint.cal.barber"),
            date: TT("appoint.cal.date") || "Date",
            time: TT("appoint.cal.time") || "Time",
            notes: TT("appoint.cal.notes"),
            phone: TT("appoint.cal.phone"),
        };

        const dateFormatted = formatDateLong(date);
        const timeRange = `${startTime} – ${endTime}`;

        const description =
            `${L.client}: ${name}
` +
            `${L.service}: ${serviceName}
` +
            `${L.barber}: ${dresser}
` +
            `${L.date}: ${dateFormatted}
` +
            `${L.time}: ${timeRange}
` +
            `${L.notes}: ${safeNotes || "—"}
` +
            `${L.phone}: (450) 472-0174`;

        const start = formatLocalIcsDateTime(date, startTime);
        const end = formatLocalIcsDateTime(date, endTime);

        const cal_ics = (() => {
            const params = new URLSearchParams({
                service: "apple",
                title,
                start,
                end,
                timezone: "America/Toronto",
                description,
                location,
                reminder: 1440,
            });
            return `https://calndr.link/d/event/?${params.toString()}`;
        })();

        const cal_google = buildGoogleCalendarLink({ title, description, location, date, startTime, endTime });
        const cal_outlook = buildOutlookCalendarLink({ title, description, location, date, startTime, endTime });
        const manageUrl = "https://ubarbershop.ca/HTML/profile.html";
        const cancelUrl = appointmentId
            ? `https://ubarbershop.ca/HTML/profile.html?cancel=${encodeURIComponent(appointmentId)}`
            : manageUrl;

        const E = {
            thankYou: TT_LANG(lang, "appoint.email.thankYou"),
            confirmed: TT_LANG(lang, "appoint.email.confirmed"),
            with: TT_LANG(lang, "appoint.email.with"),
            clientNotes: TT_LANG(lang, "appoint.email.clientNotes"),
            addToCalendar: TT_LANG(lang, "appoint.email.addToCalendar"),
            btnGoogle: TT_LANG(lang, "appoint.email.btnGoogle"),
            btnOutlook: TT_LANG(lang, "appoint.email.btnOutlook"),
            btnIphone: TT_LANG(lang, "appoint.email.btnIphone"),
            tip: TT_LANG(lang, "appoint.email.tip"),
            cancelText: TT_LANG(lang, "appoint.email.cancelText"),
            clickHere: TT_LANG(lang, "appoint.email.clickHere"),
            thanks: TT_LANG(lang, "appoint.email.thanks"),
            shopPhoneLabel:
                TT_LANG(lang, "appoint.email.shopPhoneLabel") ||
                (isFr ? "Téléphone" : "Phone"),
        };

        const htmlContent = buildConfirmationEmailHtml({
            name,
            serviceName,
            dateFormatted,
            timeRange,
            dresser,
            notes: safeNotes,
            cancelUrl,
            cal_google,
            cal_outlook,
            cal_ics,
            email_preview,
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
                name: "UBarbershop"
            },
            to: [{ email, name }],
            subject: email_subject,
            htmlContent,
        };

        return sendBrevoEmail(payload);
    }

    async function scheduleReminderEmail({ name, email, serviceName, date, startTime, endTime, dresser, notes, lang, reminderAtMs }) {
        if (!email || reminderAtMs == null) {
            return { skipped: true, reason: "missing_reminder_data", delivery: "brevo" };
        }

        const now = Date.now();
        const appointmentAtMs = toLocalDateTimeMs(date, startTime);
        const maxBrevoScheduleMs = 72 * 60 * 60 * 1000;
        const msUntilReminder = reminderAtMs - now;

        console.log("🕒 Current time:", new Date(now).toLocaleString());
        console.log("📅 Appointment time (local):", appointmentAtMs == null ? "invalid" : new Date(appointmentAtMs).toLocaleString());
        console.log("⏰ Reminder time (exact local 24h before):", new Date(reminderAtMs).toLocaleString());
        console.log("🌍 Timezone offset now / appointment / reminder:", new Date(now).getTimezoneOffset(), appointmentAtMs == null ? "invalid" : new Date(appointmentAtMs).getTimezoneOffset(), new Date(reminderAtMs).getTimezoneOffset());

        if (appointmentAtMs == null) {
            console.warn("⚠️ Reminder skipped (invalid appointment date/time)", { date, startTime });
            return { skipped: true, reason: "invalid_appointment_datetime", delivery: "brevo" };
        }

        if (appointmentAtMs <= now) {
            return { skipped: true, reason: "appointment_already_passed", delivery: "brevo" };
        }

        if (reminderAtMs <= now) {
            console.log("⚠️ Reminder skipped (24h time already passed)");
            return { skipped: true, reason: "reminder_time_already_passed", delivery: "brevo" };
        }

        if (msUntilReminder > maxBrevoScheduleMs) {
            return { skipped: true, reason: "outside_brevo_schedule_window", delivery: "runner" };
        }

        const safeNotes = (notes || "").trim() || "—";
        const isFr = String(lang || currentLang()).startsWith("fr");
        const email_subject = TT_LANG(lang, "appoint.email.reminderSubject");
        const email_preview = TT_LANG(lang, "appoint.email.reminderPreview");
        const dateFormatted = formatDateLong(date);
        const timeRange = `${startTime} – ${endTime}`;

        const E = {
            reminderTitle: TT_LANG(lang, "appoint.email.reminderTitle"),
            reminderIntro: TT_LANG(lang, "appoint.email.reminderIntro"),
            with: TT_LANG(lang, "appoint.email.with"),
            clientNotes: TT_LANG(lang, "appoint.email.clientNotes"),
            thanks: TT_LANG(lang, "appoint.email.thanks"),
            shopPhoneLabel:
                TT_LANG(lang, "appoint.email.shopPhoneLabel") ||
                (isFr ? "Téléphone" : "Phone"),
        };

        const htmlContent = buildReminderEmailHtml({
            name,
            serviceName,
            dateFormatted,
            timeRange,
            dresser,
            notes: safeNotes,
            email_preview,
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
                name: "UBarbershop"
            },
            to: [{ email, name }],
            subject: email_subject,
            htmlContent,
            scheduledAt: new Date(reminderAtMs).toISOString(),
        };

        const res = await sendBrevoEmail(payload);
        console.log("✅ Reminder email scheduled with Brevo");
        return { ...(res || {}), scheduled: true, sentNow: false, delivery: "brevo" };
    }


    // ========= Submit =========
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        scrollToTopSmooth();

        errorEl.textContent = "";
        successEl.textContent = "";

        if (!currentUser) {
            errorEl.textContent = "Please log in to book and manage your appointments.";
            return;
        }

        const employees = getEmployees();
        if (!employees.length) {
            errorEl.textContent = TT("appoint.noStylists");
            return;
        }

        const serviceId = (serviceSelect.value || "").trim();
        const serviceObj = getServiceById(serviceId);

        const date = dateInput.value;
        const time = timeSelect.value || "";

        const name = $("name")?.value?.trim() || "";
        const phone = $("phone")?.value?.trim() || "";
        const email = $("email")?.value?.trim() || "";
        const notes = $("notes")?.value?.trim() || "";

        if (!serviceId || !date || !time || !name || !email) {
            errorEl.textContent = TT("appoint.fillRequired");
            return;
        }

        // basic email validation (form uses novalidate)
        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!emailOk) {
            errorEl.textContent = TT("appoint.invalidEmail");
            return;
        }

        const anyBox = $("dresser-any");
        const preferredIds =
            anyBox && anyBox.checked
                ? employees.map((e) => e.id)
                : Array.from(document.querySelectorAll(".dresser-check:checked")).map((cb) => cb.value);

        if (!preferredIds.length) {
            errorEl.textContent = TT("appoint.pickStylist");
            return;
        }

        const duration = serviceObj?.duration ?? 0;
        slotMapForSelectedDate = getSlotMapForDate(date, duration, getSelectedEmployeesForAvailability());

        const availableAtTime = slotMapForSelectedDate.get(time) || [];
        const preferredSet = new Set(preferredIds);
        const candidates = availableAtTime.filter((empId) => preferredSet.has(empId));

        if (!candidates.length) {
            errorEl.textContent = TT("appoint.noPreferredAtTime");
            return;
        }

        const chosenId = candidates[Math.floor(Math.random() * candidates.length)];
        const chosenEmp = employees.find((e) => e.id === chosenId);

        if (chosenEmp && slotConflicts(date, time, duration, [chosenEmp])) {
            errorEl.textContent = TT("appoint.overlap");
            return;
        }

        const endTime = serviceObj?.duration ? addMinutesToTime(time, serviceObj.duration) : "";

        try {
            const lockId = makeLockId(chosenId, date, time);
            const lockRef = doc(db, "slotLocks", lockId);
            const apptRef = doc(collection(db, "appointments"));

            await runTransaction(db, async (tx) => {
                const lockSnap = await tx.get(lockRef);
                if (lockSnap.exists()) {
                    throw new Error("This time slot was just taken. Please pick another time.");
                }

                tx.set(lockRef, {
                    employeeId: chosenId,
                    date,
                    time,
                    userId: currentUser.uid,
                    createdAt: serverTimestamp(),
                    appointmentId: apptRef.id,
                });

                const appointmentAtMs = toLocalDateTimeMs(date, time);
                const currentLangCode = currentLang().startsWith("fr") ? "fr" : "en";
                const serviceNameEn = serviceObj?.nameEn || serviceObj?.nameFr || getServiceDisplayName(serviceObj) || serviceId || "";
                const serviceNameFr = serviceObj?.nameFr || serviceObj?.nameEn || getServiceDisplayName(serviceObj) || serviceId || "";

                tx.set(apptRef, {
                    userId: currentUser.uid,

                    serviceId: serviceObj?.id || serviceId,
                    serviceNameEn,
                    serviceNameFr,
                    duration: serviceObj?.duration ?? null,
                    price: serviceObj?.price ?? null,

                    dressers: [chosenId],
                    dresserName: chosenEmp?.name || "",
                    dresserId: chosenId,
                    dresserNames: [chosenEmp?.name || ""],
                    date,
                    time,
                    endTime,
                    lang: currentLangCode,
                    appointmentAtMs,
                    reminderAtMs: getReminderAtMsLocal24hBefore(date, time),
                    reminderSent: false,
                    reminderSentAt: null,
                    reminderDelivery: "runner",
                    reminderScheduleStatus: "pending",
                    reminderLastError: "",
                    reminderMessageId: "",

                    name,
                    phone,
                    email: email || "",
                    notes: notes || "",

                    lockId,
                    createdAt: serverTimestamp(),
                });
            });

            await loadMyAppointments();
            renderAppointments();
            renderPastAppointmentsModal();

            successEl.textContent = TT("appoint.saved");

            const serviceName = serviceObj
                ? getServiceDisplayName(serviceObj)
                : (TT("appoint.serviceLabel") || "Service");
            const chosenName = chosenEmp?.name || "";

            const currentLangCode = currentLang().startsWith("fr") ? "fr" : "en";
            const resolvedEndTime = endTime || addMinutesToTime(time, serviceObj?.duration ?? 0);
            const appointmentAtMs = toLocalDateTimeMs(date, time);
            const reminderAtMs = getReminderAtMsLocal24hBefore(date, time);

            console.log(
                "📅 Booking appointment for:",
                appointmentAtMs == null ? "invalid" : new Date(appointmentAtMs).toLocaleString()
            );
            console.log(
                "⏰ Reminder scheduled for (exact local 24h before):",
                reminderAtMs == null ? "invalid" : new Date(reminderAtMs).toLocaleString()
            );

            sendConfirmationEmail({
                name,
                email,
                serviceName,
                date,
                startTime: time,
                endTime: resolvedEndTime,
                dresser: chosenName || chosenId,
                notes,
                lang: currentLangCode,
                appointmentId: apptRef.id,
            })
                .then(() => console.log("📧 Confirmation email sent (or skipped)"))
                .catch((err) => console.error("❌ Confirmation email failed:", err));

            try {
                const reminderResult = await scheduleReminderEmail({
                    name,
                    email,
                    serviceName,
                    date,
                    startTime: time,
                    endTime: resolvedEndTime,
                    dresser: chosenName || chosenId,
                    notes,
                    lang: currentLangCode,
                    reminderAtMs,
                });

                console.log("⏰ Reminder email scheduling result", reminderResult);

                try {
                    await updateDoc(doc(db, "appointments", apptRef.id), {
                        reminderDelivery: reminderResult?.delivery || (reminderResult?.scheduled ? "brevo" : "runner"),
                        reminderScheduleStatus: reminderResult?.scheduled ? "scheduled" : (reminderResult?.reason || "pending"),
                        reminderLastError: "",
                        reminderMessageId: reminderResult?.messageId || "",
                    });
                } catch (updateErr) {
                    console.warn("⚠️ Could not update reminder metadata:", updateErr);
                }
            } catch (err) {
                console.error("❌ Reminder schedule failed:", err);
                try {
                    await updateDoc(doc(db, "appointments", apptRef.id), {
                        reminderDelivery: "brevo",
                        reminderScheduleStatus: "schedule_failed",
                        reminderLastError: String(err?.message || err || "Reminder scheduling failed"),
                        reminderMessageId: "",
                    });
                } catch (updateErr) {
                    console.warn("⚠️ Could not save reminder error metadata:", updateErr);
                }
            }

            form.reset();
            resetDresserUI();
            clearSelectedDateAndTimes(false);
            setBookingVisibility();
            scrollToTopInstant();
        } catch (err) {
            console.error("❌ Firestore save failed:", err);
            errorEl.textContent = `${err.code || "error"}: ${err.message || "Could not save the appointment."}`;
        }
    });

    // ========= Past appointments modal =========
    clearBtn.addEventListener("click", () => {
        if (!currentUser) {
            errorEl.textContent = TT("appoint.loginToManage");
            return;
        }
        errorEl.textContent = "";
        openPastAppointmentsModal();
    });

    pastCloseBtn.addEventListener("click", closePastAppointmentsModal);
    pastOverlay.addEventListener("click", (e) => {
        if (e.target === pastOverlay) closePastAppointmentsModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && pastOverlay.style.display === "flex") {
            closePastAppointmentsModal();
        }
    });

    // ========= Re-render / init =========
    function initOrRerender() {
        buildServiceOptions();
        renderDresserCheckboxes();
        setupDresserSelectAll();
        renderAppointments();
        renderPastAppointmentsModal();

        setBookingVisibility();
        if (shouldShowBooking()) {
            renderCalendar();
            buildTimeOptionsDynamic();
        }
    }

    // Service change => reevaluate + rebuild calendar
    serviceSelect.addEventListener("change", () => {
        clearSelectedDateAndTimes(false);
        setBookingVisibility();
        if (shouldShowBooking()) renderCalendar();
    });

    // ✅ If user changes date manually, keep time disabled/enabled correctly
    dateInput.addEventListener("change", () => {
        setBookingVisibility();
        buildTimeOptionsDynamic();
        if (shouldShowBooking()) renderCalendar();
    });

    // ========= Preselect service from Home link =========
    function preselectServiceFromURL() {
        const params = new URLSearchParams(window.location.search);
        // Accept either ?service=<legacySlug> OR ?serviceId=<FirestoreDocId>
        let svc = (params.get("serviceId") || params.get("service") || "").trim();
        if (!svc) return;

        const legacy = {
            Haircut: "haircut",
            Kids: "kids",
            Beard: "beard",
            "Haircut+Beard": "hair_beard",
            haircut_beard: "hair_beard",
        };
        svc = legacy[svc] || svc;

        // 1) Direct match against <option value>
        if (Array.from(serviceSelect.options).some((o) => o.value === svc)) {
            serviceSelect.value = svc;
            serviceSelect.dispatchEvent(new Event("change"));
            return;
        }

        // If services come from Firestore, IDs can be auto-generated.
        // Home links still pass legacy slugs like "haircut" / "kids".
        // Resolve slug -> Firestore service by matching service names.
        const norm = (s) =>
            String(s || "")
                .trim()
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim();

        const svcNorm = norm(svc);
        const list = Array.isArray(servicesCache) ? servicesCache : [];

        // 2) Exact match against Firestore doc id
        let match = list.find((s) => String(s?.id || "") === svc);

        // 3) Exact match against nameEn/nameFr
        if (!match) {
            match = list.find((s) => norm(s?.nameEn) === svcNorm || norm(s?.nameFr) === svcNorm);
        }

        // 4) Heuristics for the common legacy slugs
        if (!match) {
            const has = (s, w) => norm(s).includes(w);
            const pick = (fn) => list.find((s) => fn(s?.nameEn || "", s?.nameFr || ""));

            if (svcNorm === "haircut") {
                match = pick((en, fr) =>
                    (has(en, "hair") || has(fr, "cheveu") || has(fr, "coupe")) &&
                    !has(en, "beard") && !has(fr, "barbe") &&
                    !has(en, "kid") && !has(en, "child") && !has(fr, "enfant")
                );
            } else if (svcNorm === "kids" || svcNorm === "kid" || svcNorm === "kids haircut") {
                match = pick((en, fr) => has(en, "kid") || has(en, "child") || has(fr, "enfant"));
            } else if (svcNorm === "beard") {
                match = pick((en, fr) => (has(en, "beard") || has(fr, "barbe")) && !has(en, "hair") && !has(fr, "cheveu"));
            } else if (
                svcNorm === "hair beard" ||
                svcNorm === "hair_beard" ||
                svcNorm === "haircut beard" ||
                svcNorm === "haircut beard trim"
            ) {
                match = pick((en, fr) =>
                    (has(en, "hair") || has(fr, "cheveu") || has(fr, "coupe")) &&
                    (has(en, "beard") || has(fr, "barbe"))
                );
            }
        }

        if (match && Array.from(serviceSelect.options).some((o) => o.value === match.id)) {
            serviceSelect.value = match.id;
            serviceSelect.dispatchEvent(new Event("change"));
        }
    }

    // Start listeners
    startEmployeesListener();
    startUnavailableListener();

    // Load services (Firestore first) then render
    loadServicesOnce()
        .then(() => {
            initOrRerender();
            preselectServiceFromURL();
            startServicesListener();
        })
        .catch(() => {
            initOrRerender();
            preselectServiceFromURL();
        });

    // Language change => rebuild everything
    window.addEventListener("lang:changed", () => {
        const current = serviceSelect.value;
        initOrRerender();
        if (current) {
            serviceSelect.value = current;
            serviceSelect.dispatchEvent(new Event("change"));
        } else {
            preselectServiceFromURL();
        }
    });

    // ========= Auth state =========
    onAuthStateChanged(auth, async (user) => {
        currentUser = user || null;

        // Block booking UI until the user logs in
        if (!currentUser) showLoginRequired();
        else hideLoginRequired();

        if (btnLogout) btnLogout.style.display = currentUser ? "" : "none";
        if (btnLogin) btnLogin.style.display = currentUser ? "none" : "";
        if (btnSignup) btnSignup.style.display = currentUser ? "none" : "";

        if (authStatus) {
            authStatus.textContent = currentUser
                ? TT("appoint.authLoggedInAs", { email: currentUser.email })
                : TT("appoint.authLoggedOut");
        }

        // ✅ Autofill name/email from account (but editable)
        // Only fill if the fields are currently empty.
        const nameEl = $("name");
        const emailEl = $("email");
        if (currentUser) {
            if (nameEl && !nameEl.value.trim() && currentUser.displayName) {
                nameEl.value = currentUser.displayName;
            }
            if (emailEl && !emailEl.value.trim() && currentUser.email) {
                emailEl.value = currentUser.email;
            }
        }

        await loadMyAppointments();
        renderAppointments();
        renderPastAppointmentsModal();
        if (!currentUser) closePastAppointmentsModal();

        clearSelectedDateAndTimes(false);
        setBookingVisibility();
        if (shouldShowBooking()) renderCalendar();
    });
});
