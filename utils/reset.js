import { getDailyStats } from "./storage.js";

const MIDNIGHT_ALARM = "url-habit-limiter-midnight-reset";

function msUntilNextLocalMidnight() {
    const now = new Date();
    const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        5,
    );
    return nextMidnight.getTime() - now.getTime();
}

function scheduleMidnightReset() {
    chrome.alarms.create(MIDNIGHT_ALARM, {
        when: Date.now() + msUntilNextLocalMidnight(),
        periodInMinutes: 24 * 60,
    });
}

async function handleAlarm(alarm) {
    if (alarm.name !== MIDNIGHT_ALARM) return false;
    await getDailyStats(); // triggers archive + fresh day if the date rolled over
    return true;
}

export { MIDNIGHT_ALARM, scheduleMidnightReset, handleAlarm };
