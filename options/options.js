import {
    getRules,
    getSettings,
    saveSettings,
    getStatsHistory,
    getDailyStats,
} from "../utils/storage.js";
import { addRule, updateRule, deleteRule, toggleRule } from "../utils/rules.js";

const rulesTableEl = document.getElementById("rulesTable");
const historyTableEl = document.getElementById("historyTable");
const warnThresholdEl = document.getElementById("warnThreshold");
const ruleModal = document.getElementById("ruleModal");
const ruleForm = document.getElementById("ruleForm");
const modalTitle = document.getElementById("modalTitle");

const fieldName = document.getElementById("fieldName");
const fieldPattern = document.getElementById("fieldPattern");
const fieldLimit = document.getElementById("fieldLimit");
const fieldRedirect = document.getElementById("fieldRedirect");

let editingRuleId = null;

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
}

function countClass(count, limit) {
    const pct = limit > 0 ? count / limit : 0;
    if (pct >= 1) return "danger";
    if (pct >= 0.8) return "warn";
    return "";
}

async function renderRules() {
    const [rules, dailyStats] = await Promise.all([
        getRules(),
        getDailyStats(),
    ]);
    rulesTableEl.innerHTML = "";

    if (rules.length === 0) {
        rulesTableEl.innerHTML = `<div class="empty-rules">No rules yet. Click "New rule" to limit your first URL pattern.</div>`;
        return;
    }

    for (const rule of rules) {
        const count = dailyStats.counters[rule.id] || 0;
        const row = document.createElement("div");
        row.className = `rule-row${rule.enabled ? "" : " is-disabled"}`;
        row.innerHTML = `
      <button class="toggle${rule.enabled ? " is-on" : ""}" aria-label="Toggle ${escapeHtml(rule.name)}" aria-pressed="${rule.enabled}"></button>
      <div class="rule-name-cell">${escapeHtml(rule.name)}</div>
      <div class="rule-pattern-cell">${escapeHtml(rule.urlPattern)}</div>
      <div class="rule-limit-cell">≤ ${rule.dailyLimit}/day</div>
      <div class="rule-count-cell ${countClass(count, rule.dailyLimit)}">${count} today</div>
      <div class="row-actions">
        <button class="uhl-btn edit-btn">Edit</button>
        <button class="uhl-btn uhl-btn-danger delete-btn">Delete</button>
      </div>
    `;

        row.querySelector(".toggle").addEventListener("click", async (e) => {
            const btn = e.currentTarget;
            const newState = !btn.classList.contains("is-on");
            await toggleRule(rule.id, newState);
            btn.classList.toggle("is-on", newState);
            btn.setAttribute("aria-pressed", String(newState));
            row.classList.toggle("is-disabled", !newState);
        });

        row.querySelector(".edit-btn").addEventListener("click", () =>
            openModal(rule),
        );
        row.querySelector(".delete-btn").addEventListener("click", async () => {
            if (
                confirm(`Delete the rule "${rule.name}"? This can't be undone.`)
            ) {
                await deleteRule(rule.id);
                renderRules();
            }
        });

        rulesTableEl.appendChild(row);
    }
}

function openModal(rule = null) {
    editingRuleId = rule?.id || null;
    modalTitle.textContent = rule ? "Edit rule" : "New rule";
    fieldName.value = rule?.name || "";
    fieldPattern.value = rule?.urlPattern || "";
    fieldLimit.value = rule?.dailyLimit ?? 10;
    fieldRedirect.value = rule?.redirectUrl || "";
    ruleModal.showModal();
    fieldName.focus();
}

document
    .getElementById("newRuleBtn")
    .addEventListener("click", () => openModal());
document
    .getElementById("cancelBtn")
    .addEventListener("click", () => ruleModal.close());

ruleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
        name: fieldName.value,
        urlPattern: fieldPattern.value,
        dailyLimit: fieldLimit.value,
        redirectUrl: fieldRedirect.value,
    };

    if (editingRuleId) {
        await updateRule(editingRuleId, {
            ...payload,
            dailyLimit: Math.max(1, parseInt(payload.dailyLimit, 10) || 10),
        });
    } else {
        await addRule(payload);
    }

    ruleModal.close();
    renderRules();
});

// --- Settings ---
async function renderSettings() {
    const settings = await getSettings();
    warnThresholdEl.value = settings.warnThresholdPercent;
}

warnThresholdEl.addEventListener("change", async () => {
    const value = Math.min(
        100,
        Math.max(1, parseInt(warnThresholdEl.value, 10) || 80),
    );
    warnThresholdEl.value = value;
    await saveSettings({ warnThresholdPercent: value });
});

// --- History ---
async function renderHistory() {
    const [history, rules] = await Promise.all([getStatsHistory(), getRules()]);
    const ruleNameById = Object.fromEntries(rules.map((r) => [r.id, r]));
    const dates = Object.keys(history)
        .sort((a, b) => (a < b ? 1 : -1))
        .slice(0, 14);

    if (dates.length === 0) {
        historyTableEl.innerHTML = `<div class="empty-rules">No history yet — check back after your first full day.</div>`;
        return;
    }

    historyTableEl.innerHTML = dates
        .map((date) => {
            const day = history[date];
            const chips =
                Object.entries(day.counters)
                    .map(([ruleId, count]) => {
                        const rule = ruleNameById[ruleId];
                        const label = rule ? rule.name : "Deleted rule";
                        const over = rule && count > rule.dailyLimit;
                        return `<span class="history-chip${over ? " over" : ""}">${escapeHtml(label)}: ${count}</span>`;
                    })
                    .join("") ||
                '<span class="history-chip">No activity</span>';

            return `<div class="history-row"><div class="history-date">${date}</div><div>${chips}</div></div>`;
        })
        .join("");
}

async function init() {
    await Promise.all([renderRules(), renderSettings(), renderHistory()]);
}

init();
