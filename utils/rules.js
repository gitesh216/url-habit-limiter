import { getRules, saveRules } from "./storage.js";

function generateId() {
    return `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Normalizes a URL for matching: strips protocol + leading "www."
function normalizeUrl(rawUrl) {
    try {
        const u = new URL(rawUrl);
        const host = u.hostname.replace(/^www\./, "");
        return `${host}${u.pathname}${u.search}`;
    } catch {
        return rawUrl.replace(/^https?:\/\//, "").replace(/^www\./, "");
    }
}

// Turns a user-authored pattern ("youtube.com/shorts/*", "reddit.com", "x.com/*")
// into a case-insensitive regex. '*' is a wildcard; everything else is literal.
function patternToRegex(pattern) {
    const cleanPattern = pattern
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "");
    const escaped = cleanPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const withWildcards = escaped.replace(/\*/g, ".*");
    return new RegExp(withWildcards, "i");
}

function matchesRule(url, rule) {
    if (!rule.enabled) return false;
    if (!rule.urlPattern) return false;
    try {
        const regex = patternToRegex(rule.urlPattern);
        return regex.test(normalizeUrl(url));
    } catch {
        return false;
    }
}

// Finds the first enabled rule that matches a given URL (first match wins,
// so more specific rules should be listed above broader ones by the user).
function findMatchingRule(url, rules) {
    return rules.find((rule) => matchesRule(url, rule)) || null;
}

// Generic "content unit" fingerprint used for duplicate-visit detection.
// Works across sites without platform-specific parsing: prefer a known
// id-style query param, otherwise fall back to the last path segment.
const ID_QUERY_KEYS = ["v", "id", "post", "story_id", "clip", "video_id"];

function extractUnitId(url) {
    try {
        const u = new URL(url);
        for (const key of ID_QUERY_KEYS) {
            if (u.searchParams.has(key))
                return `q:${key}=${u.searchParams.get(key)}`;
        }
        const segments = u.pathname.split("/").filter(Boolean);
        if (segments.length > 0) return `p:${segments[segments.length - 1]}`;
        return `p:${u.hostname}`;
    } catch {
        return url;
    }
}

async function addRule(ruleInput) {
    const rules = await getRules();
    const rule = {
        id: generateId(),
        name: ruleInput.name?.trim() || ruleInput.urlPattern,
        urlPattern: ruleInput.urlPattern.trim(),
        dailyLimit: Math.max(1, parseInt(ruleInput.dailyLimit, 10) || 10),
        redirectUrl: ruleInput.redirectUrl?.trim() || "",
        enabled: ruleInput.enabled !== false,
    };
    rules.push(rule);
    await saveRules(rules);
    return rule;
}

async function updateRule(id, updates) {
    const rules = await getRules();
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Rule ${id} not found`);
    rules[idx] = { ...rules[idx], ...updates };
    await saveRules(rules);
    return rules[idx];
}

async function deleteRule(id) {
    const rules = await getRules();
    const filtered = rules.filter((r) => r.id !== id);
    await saveRules(filtered);
    return filtered;
}

async function toggleRule(id, enabled) {
    return updateRule(id, { enabled });
}

export {
    generateId,
    normalizeUrl,
    patternToRegex,
    matchesRule,
    findMatchingRule,
    extractUnitId,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
};
