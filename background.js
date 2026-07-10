import { getRules } from "./utils/storage.js";
import { findMatchingRule } from "./utils/rules.js";
import { recordVisit } from "./utils/tracker.js";

async function handleNavigation(tabId, url) {
    if (!url || !/^https?:\/\//i.test(url)) return;

    const rules = await getRules();
    const rule = findMatchingRule(url, rules);
    if (!rule) {
        chrome.action.setBadgeText({ tabId, text: "" });
        return;
    }

    const { count } = await recordVisit(rule);
    updateBadge(tabId, count, rule.dailyLimit);

    if (count > rule.dailyLimit) {
        redirectToBlocked(tabId, rule, count);
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

// --- SPA navigation, reported by content.js via history API patching ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "UHL_URL_CHANGED" && sender.tab?.id != null) {
        handleNavigation(sender.tab.id, message.url);
        sendResponse({ ok: true });
    }
    return false;
});
