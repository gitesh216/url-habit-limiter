import { getDailyStats, saveDailyStats } from "./storage.js";

async function recordVisit(rule) {
    const stats = await getDailyStats();
    stats.counters[rule.id] = (stats.counters[rule.id] || 0) + 1;
    await saveDailyStats(stats);
    return { count: stats.counters[rule.id] };
}

async function getCount(ruleId) {
    const stats = await getDailyStats();
    return stats.counters[ruleId] || 0;
}

async function getAllCounts() {
    const stats = await getDailyStats();
    return stats.counters;
}

export { recordVisit, getCount, getAllCounts };
