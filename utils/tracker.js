// utils/tracker.js
// Counter Manager: turns "this URL matched this rule" into an accurate daily
// count, filtering out the double-counts that plague naive trackers (a page
// refresh, a re-render, or a SPA replaceState firing twice for one video).

import { getDailyStats, saveDailyStats } from "./storage.js";
import { extractUnitId } from "./rules.js";

// If the same content unit (e.g. the same YouTube Shorts id) is seen again
// within this window, it's treated as the same visit, not a new one.
const DUPLICATE_WINDOW_MS = 4000;

/**
 * Records a visit against a rule. Returns the updated count and whether
 * this particular visit was counted (vs. filtered as a duplicate).
 */
async function recordVisit(rule, url) {
    const stats = await getDailyStats();
    const unitId = extractUnitId(url);
    const now = Date.now();

    const lastId = stats.lastShortId[rule.id];
    const lastAt = stats.lastVisited[rule.id] || 0;
    const isDuplicate = lastId === unitId && now - lastAt < DUPLICATE_WINDOW_MS;

    if (isDuplicate) {
        // Still refresh the timestamp so continued dwelling on the same unit
        // doesn't get counted the moment the window lapses.
        stats.lastVisited[rule.id] = now;
        await saveDailyStats(stats);
        return { count: stats.counters[rule.id] || 0, counted: false };
    }

    stats.counters[rule.id] = (stats.counters[rule.id] || 0) + 1;
    stats.lastVisited[rule.id] = now;
    stats.lastShortId[rule.id] = unitId;
    await saveDailyStats(stats);

    return { count: stats.counters[rule.id], counted: true };
}

async function getCount(ruleId) {
    const stats = await getDailyStats();
    return stats.counters[ruleId] || 0;
}

async function getAllCounts() {
    const stats = await getDailyStats();
    return stats.counters;
}

export { recordVisit, getCount, getAllCounts, DUPLICATE_WINDOW_MS };
