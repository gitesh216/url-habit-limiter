const KEYS = {
    RULES: "rules",
    DAILY_STATS: "dailyStats",
    SETTINGS: "settings",
};

const DEFAULT_SETTINGS = {
    warnThresholdPercent: 80, // warn the user once they cross this % of their limit
};

function getLocalDateString(date = new Date()) {
    // Local (not UTC) YYYY-MM-DD so the daily reset lines up with the user's day.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function emptyDailyStats(dateStr = getLocalDateString()) {
    return {
        date: dateStr,
        counters: {}, // { [ruleId]: number }
        lastVisited: {}, // { [ruleId]: epochMillis }
        lastShortId: {}, // { [ruleId]: string }  - last matched "unit" for dup detection
    };
}

async function storageGet(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve(result);
        });
    });
}

async function storageSet(items) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(items, () => {
            if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
            else resolve();
        });
    });
}

async function getRules() {
    const res = await storageGet(KEYS.RULES);
    return res[KEYS.RULES] || [];
}

async function saveRules(rules) {
    await storageSet({ [KEYS.RULES]: rules });
    return rules;
}

// Returns today's stats, resetting to a fresh day if the date rolled over.
async function getDailyStats() {
    const res = await storageGet(KEYS.DAILY_STATS);
    const today = getLocalDateString();
    const stored = res[KEYS.DAILY_STATS];

    if (!stored || stored.date !== today) {
        const fresh = emptyDailyStats(today);
        await storageSet({ [KEYS.DAILY_STATS]: fresh });
        return fresh;
    }
    return stored;
}

async function saveDailyStats(stats) {
    await storageSet({ [KEYS.DAILY_STATS]: stats });
    return stats;
}

async function getSettings() {
    const res = await storageGet(KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(res[KEYS.SETTINGS] || {}) };
}

async function saveSettings(settings) {
    const merged = { ...(await getSettings()), ...settings };
    await storageSet({ [KEYS.SETTINGS]: merged });
    return merged;
}

export {
    KEYS,
    DEFAULT_SETTINGS,
    getLocalDateString,
    emptyDailyStats,
    getRules,
    saveRules,
    getDailyStats,
    saveDailyStats,
    getSettings,
    saveSettings,
};
