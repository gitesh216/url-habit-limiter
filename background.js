import { getRules, getSettings } from "./utils/storage.js";
import { findMatchingRule } from "./utils/rules.js";
import { recordVisit, getCount } from "./utils/tracker.js";
import { scheduleMidnightReset, handleAlarm } from "./utils/reset.js";

// Avoid re-processing the exact same URL twice in quick succession when both
// tabs.onUpdated and a content-script message fire for the same load.
const recentlyProcessed = new Map(); // tabId -> { url, at }
const RECENT_WINDOW_MS = 500;

function alreadyProcessed(tabId, url) {
    const entry = recentlyProcessed.get(tabId);
    if (entry && entry.url === url && Date.now() - entry.at < RECENT_WINDOW_MS)
        return true;
    recentlyProcessed.set(tabId, { url, at: Date.now() });
    return false;
}

async function handleNavigation(tabId, url) {
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (alreadyProcessed(tabId, url)) return;

    const rules = await getRules();
    const rule = findMatchingRule(url, rules);
    if (!rule) {
        chrome.action.setBadgeText({ tabId, text: "" });
        return;
    }

    const { count } = await recordVisit(rule, url);
    updateBadge(tabId, count, rule.dailyLimit);

    if (count > rule.dailyLimit) {
        redirectToBlocked(tabId, rule, count);
        return;
    }

    const settings = await getSettings();
    const percent = (count / rule.dailyLimit) * 100;
    if (percent >= settings.warnThresholdPercent) {
        chrome.tabs
            .sendMessage(tabId, {
                type: "UHL_SHOW_WARNING",
                ruleName: rule.name,
                count,
                limit: rule.dailyLimit,
                remaining: Math.max(0, rule.dailyLimit - count),
            })
            .catch(() => {
                /* content script may not be ready yet - non-fatal */
            });
    }
}

function updateBadge(tabId, count, limit) {
    const overLimit = count > limit;
    chrome.action.setBadgeText({ tabId, text: String(count) });
    chrome.action.setBadgeBackgroundColor({
        tabId,
        color: overLimit
            ? "#A33B3B"
            : count / limit >= 0.8
              ? "#C97A2B"
              : "#2B6E5E",
    });
}

function redirectToBlocked(tabId, rule, count) {
    if (rule.redirectUrl) {
        chrome.tabs.update(tabId, { url: rule.redirectUrl }).catch(() => {});
        return;
    }
    const params = new URLSearchParams({
        rule: rule.name,
        limit: String(rule.dailyLimit),
        count: String(count),
    });
    chrome.tabs
        .update(tabId, {
            url: chrome.runtime.getURL(
                `blocked/blocked.html?${params.toString()}`,
            ),
        })
        .catch(() => {});
}

// --- Traditional (full page load) navigation ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "loading" && tab.url) {
        handleNavigation(tabId, tab.url);
    }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.url) handleNavigation(tabId, tab.url);
    } catch {
        /* tab may have closed */
    }
});

// --- SPA navigation, reported by content.js via history API patching ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "UHL_URL_CHANGED" && sender.tab?.id != null) {
        handleNavigation(sender.tab.id, message.url);
        sendResponse({ ok: true });
    }
    if (message?.type === "UHL_GET_STATUS_FOR_TAB" && sender.tab?.id != null) {
        (async () => {
            const rules = await getRules();
            const rule = findMatchingRule(message.url, rules);
            if (!rule) return sendResponse({ matched: false });
            const count = await getCount(rule.id);
            sendResponse({
                matched: true,
                ruleName: rule.name,
                count,
                limit: rule.dailyLimit,
            });
        })();
        return true; // keep the message channel open for the async response
    }
    return false;
});

// --- Daily reset scheduling ---
chrome.runtime.onInstalled.addListener(() => scheduleMidnightReset());
chrome.runtime.onStartup.addListener(() => scheduleMidnightReset());
chrome.alarms.onAlarm.addListener((alarm) => {
    handleAlarm(alarm);
});
