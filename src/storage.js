// storage.js — Incognito-safe localStorage Wrapper

const Storage = (() => {

  function get(key) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : null;
    } catch (e) { return null; }
  }

  function set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function remove(key) {
    try { localStorage.removeItem(key); return true; }
    catch (e) { return false; }
  }

  const KEYS = {
    HIGH_SCORE:       'br_highscore',
    BEST_CHAIN:       'br_bestchain',
    TOTAL_STARS:      'br_total_stars',
    DAILY_PREFIX:     'br_daily_',      // + YYYYMMDD
    // Upgrades:      'br_upg_' + id   (in upgrades.js)

    // Prestige
    PRESTIGE_LEVEL:   'br_prestige',

    // Daily Streak
    STREAK_COUNT:     'br_streak',
    STREAK_LAST_DATE: 'br_streak_last',

    // Weekly Challenge
    WEEKLY_PREFIX:    'br_weekly_',     // + YYYYWW

    // Score Milestones
    TOTAL_SCORE_ALL:  'br_score_total',
    MILESTONES_DONE:  'br_milestones',  // Array von Indizes
  };

  // ── Datum-Helpers ──────────────────────────────────────────────────────
  function _dateString(offsetDays = 0) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  function _weekString() {
    const d   = new Date();
    const jan1 = new Date(d.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getUTCFullYear()}${String(week).padStart(2, '0')}`;
  }

  // ── Daily Board Tracking ───────────────────────────────────────────────
  function hasDailyPlayedToday() { return get(KEYS.DAILY_PREFIX + _dateString()) === true; }
  function markDailyPlayedToday(score) {
    set(KEYS.DAILY_PREFIX + _dateString(), true);
    if (typeof score === 'number') set(KEYS.DAILY_PREFIX + _dateString() + '_score', score);
  }

  // ── Daily Streak ───────────────────────────────────────────────────────
  // Gibt aktuellen Streak-Stand zurück. Aktualisiert bei täglichem Spielen.
  function getAndUpdateStreak() {
    const today     = _dateString();
    const yesterday = _dateString(-1);
    const lastDate  = get(KEYS.STREAK_LAST_DATE) || '';
    const streak    = get(KEYS.STREAK_COUNT) || 0;

    if (lastDate === today) return streak;              // heute schon gezählt

    const newStreak = lastDate === yesterday ? streak + 1 : 1;
    set(KEYS.STREAK_COUNT, newStreak);
    set(KEYS.STREAK_LAST_DATE, today);
    return newStreak;
  }

  function getStreak() { return get(KEYS.STREAK_COUNT) || 0; }

  // ── Weekly Challenge ───────────────────────────────────────────────────
  function getWeekKey() { return KEYS.WEEKLY_PREFIX + _weekString(); }
  function hasWeeklyPlayedThisWeek() { return get(getWeekKey()) === true; }
  function markWeeklyPlayedThisWeek(score) {
    set(getWeekKey(), true);
    if (typeof score === 'number') set(getWeekKey() + '_score', score);
  }
  function getWeeklyScore() { return get(getWeekKey() + '_score'); }

  // ── Score Milestones ───────────────────────────────────────────────────
  function addToTotalScore(score) {
    const current = get(KEYS.TOTAL_SCORE_ALL) || 0;
    const next    = current + score;
    set(KEYS.TOTAL_SCORE_ALL, next);
    return next;
  }

  function getTotalScore() { return get(KEYS.TOTAL_SCORE_ALL) || 0; }

  function getMilestonesReached() { return get(KEYS.MILESTONES_DONE) || []; }

  function markMilestoneReached(index) {
    const reached = getMilestonesReached();
    if (!reached.includes(index)) {
      reached.push(index);
      set(KEYS.MILESTONES_DONE, reached);
    }
  }

  // ── Prestige ───────────────────────────────────────────────────────────
  function getPrestigeLevel() { return get(KEYS.PRESTIGE_LEVEL) || 0; }
  function incrementPrestige() {
    const next = getPrestigeLevel() + 1;
    set(KEYS.PRESTIGE_LEVEL, next);
    return next;
  }

  return {
    get, set, remove, KEYS,
    hasDailyPlayedToday, markDailyPlayedToday,
    getAndUpdateStreak, getStreak,
    hasWeeklyPlayedThisWeek, markWeeklyPlayedThisWeek, getWeeklyScore,
    addToTotalScore, getTotalScore,
    getMilestonesReached, markMilestoneReached,
    getPrestigeLevel, incrementPrestige,
  };
})();