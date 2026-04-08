// admin.js (Firestore-backed employees)
// ✅ Requires: ./firebase.js
// ✅ Load as: <script type="module" src="../js/admin.js"></script>

import { auth, db } from "./firebase.js";
import { opportunisticScheduleReminders } from "./reminderScheduler.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

console.log("admin.js connected ✅");

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user?.email === "ubarbershop2023@gmail.com") {
            try { opportunisticScheduleReminders(); } catch (err) { console.warn("Reminder auto-scheduler skipped:", err); }
        }
    });
    const $ = (id) => document.getElementById(id);

    const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

    // Main form
    const form = $("employee-form");
    const nameEl = $("emp-name");
    const weekGridEl = $("week-grid");
    const listEl = $("employee-list");
    const msgEl = $("admin-msg");
    const errEl = $("admin-error");

    // Edit modal
    const overlayEl = $("edit-overlay");
    const modalEl = $("edit-modal");
    const editForm = $("edit-form");
    const editNameEl = $("edit-name");
    const editWeekGridEl = $("edit-week-grid");
    const editCloseBtn = $("edit-close");
    const editCancelBtn = $("edit-cancel");

    if (
        !form ||
        !nameEl ||
        !weekGridEl ||
        !listEl ||
        !overlayEl ||
        !modalEl ||
        !editForm ||
        !editNameEl ||
        !editWeekGridEl
    ) {
        console.warn("admin.js: required elements not found on this page.");
        return;
    }

    // -------------------------
    // Helpers
    // -------------------------
    const escapeHtml = (str) =>
        String(str ?? "").replace(/[&<>"']/g, (s) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        }[s]));

    function clearMessages() {
        if (msgEl) msgEl.textContent = "";
        if (errEl) errEl.textContent = "";
    }
    function showMsg(text) {
        if (msgEl) msgEl.textContent = text;
    }
    function showErr(text) {
        if (errEl) errEl.textContent = text;
    }

    function getLocale() {
        return localStorage.getItem("lang") === "fr" ? "fr-CA" : "en-CA";
    }

    function cap(str) {
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
    }

    function weekdayLabelsShort() {
        const locale = getLocale();
        const base = new Date(2023, 0, 2); // Monday
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            const shortName = d.toLocaleDateString(locale, { weekday: "short" });
            return cap(shortName.replace(".", ""));
        });
    }

    function defaultSchedule() {
        const s = {};
        DAY_KEYS.forEach((k) => {
            const isWeekday = k !== "sun" && k !== "sat"; // ✅ Mon–Fri default ON
            s[k] = { on: isWeekday, start: "09:00", end: "17:00" };
        });
        return s;
    }

    // -------------------------
    // Build Schedule UI
    // -------------------------
    function buildTimeOptions(selected) {
        let html = "";
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 5) {
                const hh = String(h).padStart(2, "0");
                const mm = String(m).padStart(2, "0");
                const value = `${hh}:${mm}`;
                html += `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`;
            }
        }
        return html;
    }

    function buildWeekGrid(containerEl, schedule = null) {
        const labels = weekdayLabelsShort();
        const s = schedule || defaultSchedule();

        containerEl.innerHTML = labels
            .map((label, i) => {
                const dayKey = DAY_KEYS[i];
                const day = s[dayKey] || { on: true, start: "09:00", end: "17:00" };

                return `
          <div class="day-row compact ${day.on ? "" : "is-off"}" data-row-day="${dayKey}">
            <label class="day-check">
              <input type="checkbox" class="day-on" data-day="${dayKey}" ${day.on ? "checked" : ""} />
              <span class="day-label">${escapeHtml(label)}</span>
            </label>

            <div class="time-pair">
              <select class="day-start" data-day="${dayKey}">
                ${buildTimeOptions(day.start)}
              </select>
              <span class="day-dash">–</span>
              <select class="day-end" data-day="${dayKey}">
                ${buildTimeOptions(day.end)}
              </select>
            </div>
          </div>
        `;
            })
            .join("");

        // Initial state + change handlers
        containerEl.querySelectorAll(".day-on").forEach((cb) => {
            const dayKey = cb.dataset.day;
            toggleDay(containerEl, dayKey, cb.checked);
            cb.addEventListener("change", () => toggleDay(containerEl, dayKey, cb.checked));
        });
    }

    // ✅ THIS is the key: disable selects AND toggle row background class
    function toggleDay(containerEl, dayKey, enabled) {
        // Disable/enable the selects
        containerEl.querySelectorAll(`[data-day="${dayKey}"]`).forEach((el) => {
            if (el.classList.contains("day-start") || el.classList.contains("day-end")) {
                el.disabled = !enabled;
            }
        });

        // Toggle row background darker
        const row = containerEl
            .querySelector(`.day-on[data-day="${dayKey}"]`)
            ?.closest(".day-row");
        if (row) row.classList.toggle("is-off", !enabled);
    }

    function readSchedule(containerEl) {
        const schedule = {};
        DAY_KEYS.forEach((k) => {
            const on = containerEl.querySelector(`.day-on[data-day="${k}"]`);
            const start = containerEl.querySelector(`.day-start[data-day="${k}"]`);
            const end = containerEl.querySelector(`.day-end[data-day="${k}"]`);

            schedule[k] = {
                on: !!on?.checked,
                start: start?.value || "09:00",
                end: end?.value || "17:00",
            };
        });
        return schedule;
    }

    // -------------------------
    // Render: pills preview
    // -------------------------
    function schedulePills(schedule) {
        const labels = weekdayLabelsShort();
        const offLabel = window.t?.("admin.off") || "Off";

        return `
      <div class="pill-grid">
        ${DAY_KEYS.map((k, i) => {
            const d = schedule?.[k] || { on: true, start: "09:00", end: "17:00" };
            const text = d.on ? `${d.start}–${d.end}` : offLabel;
            return `
            <div class="pill ${d.on ? "" : "pill-off"}">
              <span class="pill-day">${escapeHtml(labels[i])}</span>
              <span class="pill-time">${escapeHtml(text)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
    }

    // -------------------------
    // Firestore employees (live)
    // -------------------------
    let employeesCache = [];
    let editingId = null;

    function listenEmployees() {
        const q = query(collection(db, "employees"), orderBy("name"));
        onSnapshot(
            q,
            (snap) => {
                employeesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                localStorage.setItem("employees", JSON.stringify(employeesCache));
                renderEmployees();
            },
            (err) => {
                console.warn("⚠️ employees listener error (falling back to localStorage):", err);
                try {
                    employeesCache = JSON.parse(localStorage.getItem("employees") || "[]") || [];
                } catch {
                    employeesCache = [];
                }
                renderEmployees();
            }
        );
    }

    function getEmployees() {
        return Array.isArray(employeesCache) ? employeesCache : [];
    }

    // -------------------------
    // Modal open/close
    // -------------------------
    function openModal(empId) {
        const emp = getEmployees().find((e) => e.id === empId);
        if (!emp) return;

        editingId = empId;

        editNameEl.value = emp.name || "";
        buildWeekGrid(editWeekGridEl, emp.schedule || defaultSchedule());

        overlayEl.hidden = false;
        modalEl.hidden = false;

        setTimeout(() => editNameEl.focus(), 0);
    }

    function closeModal() {
        editingId = null;
        overlayEl.hidden = true;
        modalEl.hidden = true;
        editForm.reset();
        editWeekGridEl.innerHTML = "";
    }

    overlayEl.addEventListener("click", closeModal);
    editCloseBtn.addEventListener("click", closeModal);
    editCancelBtn.addEventListener("click", closeModal);

    document.addEventListener("keydown", (e) => {
        if (!modalEl.hidden && e.key === "Escape") closeModal();
    });

    // Save edit -> Firestore
    editForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearMessages();

        const newName = (editNameEl.value || "").trim();
        if (!newName) {
            showErr(window.t?.("admin.required") || "Please enter a name.");
            return;
        }
        if (!editingId) return;

        const schedule = readSchedule(editWeekGridEl);

        try {
            await updateDoc(doc(db, "employees", editingId), {
                name: newName,
                schedule,
                updatedAt: serverTimestamp(),
            });
            closeModal();
            showMsg(window.t?.("admin.updated") || "Stylist updated.");
        } catch (err) {
            console.error(err);
            showErr(err?.message || "Update failed (check Firestore rules).");
        }
    });

    // -------------------------
    // Render employees list
    // -------------------------
    function renderEmployees() {
        const employees = getEmployees();

        if (!employees.length) {
            listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">${escapeHtml(window.t?.("admin.currentEmployees") || "Current employees")}</div>
          <div class="empty-sub">${escapeHtml(window.t?.("admin.none") || "No stylists yet.")}</div>
        </div>
      `;
            return;
        }

        listEl.innerHTML = `
      <div class="cards">
        ${employees
                .map(
                    (e) => `
              <div class="emp-card">
                <div class="emp-top">
                  <div class="emp-name">${escapeHtml(e.name)}</div>

                  <div class="emp-actions">
                    <button class="btn ghost emp-edit" type="button" data-id="${escapeHtml(e.id)}">
                      ${escapeHtml(window.t?.("admin.edit") || "Edit")}
                    </button>
                    <button class="btn ghost danger emp-remove" type="button" data-id="${escapeHtml(e.id)}">
                      ${escapeHtml(window.t?.("admin.remove") || "Remove")}
                    </button>
                  </div>
                </div>

                ${schedulePills(e.schedule)}
              </div>
            `
                )
                .join("")}
      </div>
    `;

        listEl.querySelectorAll(".emp-edit").forEach((btn) => {
            btn.addEventListener("click", () => openModal(btn.dataset.id));
        });

        listEl.querySelectorAll(".emp-remove").forEach((btn) => {
            btn.addEventListener("click", async () => {
                clearMessages();
                const id = btn.dataset.id;
                if (!id) return;

                const ok = window.confirm(
                    window.t?.("confirm.deleteEmployee") || "Are you sure you want to delete this employee?"
                );
                if (!ok) return;

                try {
                    await deleteDoc(doc(db, "employees", id));
                    showMsg(window.t?.("admin.deleted") || "Employee removed.");
                } catch (err) {
                    console.error(err);
                    showErr(err?.message || "Delete failed (check Firestore rules).");
                }
            });
        });
    }

    // -------------------------
    // Add employee -> Firestore
    // -------------------------
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        clearMessages();

        const name = (nameEl.value || "").trim();
        if (!name) {
            showErr(window.t?.("admin.required") || "Please enter a name.");
            return;
        }

        const schedule = readSchedule(weekGridEl);

        try {
            await addDoc(collection(db, "employees"), {
                name,
                schedule,
                createdAt: serverTimestamp(),
            });

            showMsg(window.t?.("admin.added") || "Employee added.");
            form.reset();
            buildWeekGrid(weekGridEl); // ✅ rebuild with defaults (Mon–Fri on)
        } catch (err) {
            console.error(err);
            showErr(err?.message || "Add failed (check Firestore rules).");
        }
    });

    // Re-render on language toggle
    window.addEventListener("lang:changed", () => {
        buildWeekGrid(weekGridEl);
        renderEmployees();
        if (!modalEl.hidden && editingId) openModal(editingId);
    });

    // Init
    buildWeekGrid(weekGridEl);
    listenEmployees();
});
