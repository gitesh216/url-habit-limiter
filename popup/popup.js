import { getRules, exportAllData } from "../utils/storage.js";
import { toggleRule } from "../utils/rules.js";
import { getAllCounts } from "../utils/tracker.js";
import { buildRingSVG } from "../utils/ring.js";

const ruleListEl = document.getElementById("ruleList");
const emptyStateEl = document.getElementById("emptyState");

function statusClass(count, limit) {
    const pct = limit > 0 ? count / limit : 0;
    if (pct >= 1) return "danger";
    if (pct >= 0.8) return "warn";
    return "ok";
}

function renderRuleCard(rule, count) {
    const card = document.createElement("div");
    card.className = `rule-card${rule.enabled ? "" : " is-disabled"}`;
    card.innerHTML = `
    <div class="ring-wrap">${buildRingSVG(count, rule.dailyLimit, 36)}</div>
    <div class="rule-info">
      <p class="rule-name">${escapeHtml(rule.name)}</p>
      <p class="rule-pattern">${escapeHtml(rule.urlPattern)}</p>
      <p class="rule-count ${statusClass(count, rule.dailyLimit)}">${count} / ${rule.dailyLimit} today</p>
    </div>
    <button class="toggle${rule.enabled ? " is-on" : ""}" data-id="${rule.id}" aria-label="Toggle ${escapeHtml(rule.name)}" aria-pressed="${rule.enabled}"></button>
  `;
    card.querySelector(".toggle").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const newState = !btn.classList.contains("is-on");
        await toggleRule(rule.id, newState);
        btn.classList.toggle("is-on", newState);
        btn.setAttribute("aria-pressed", String(newState));
        card.classList.toggle("is-disabled", !newState);
    });
    return card;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

async function render() {
    const [rules, counts] = await Promise.all([getRules(), getAllCounts()]);
    ruleListEl.innerHTML = "";

    if (rules.length === 0) {
        emptyStateEl.hidden = false;
        return;
    }
    emptyStateEl.hidden = true;

    for (const rule of rules) {
        ruleListEl.appendChild(renderRuleCard(rule, counts[rule.id] || 0));
    }
}

document.getElementById("optionsBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});

document.getElementById("addFirstRuleBtn").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});

document.getElementById("exportBtn").addEventListener("click", async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    chrome.downloads
        ? chrome.downloads.download({
              url,
              filename: `url-habit-limiter-export-${dateStr}.json`,
          })
        : window.open(url); // fallback if downloads permission isn't granted
});

render();
