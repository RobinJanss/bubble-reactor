// storage.js — Incognito-safe localStorage Wrapper

const Storage = (() => {

  function get(key) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : null;
    } catch (e) {
      return null;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }

  const KEYS = {
    HIGH_SCORE:   'br_highscore',
    BEST_CHAIN:   'br_bestchain',
    TOTAL_STARS:  'br_total_stars',
    DAILY_PREFIX: 'br_daily_',
    // Upgrade-Keys: 'br_upg_' + id  → in upgrades.js genutzt
  };

  // ── Daily Board Tracking ───────────────────────────────────────────────
  function _todayKey() {
    const d   = new Date();
    const y   = d.getUTCFullYear();
    const m   = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return KEYS.DAILY_PREFIX + y + m + day;
  }

  function hasDailyPlayedToday() {
    return get(_todayKey()) === true;
  }

  function markDailyPlayedToday(score) {
    set(_todayKey(), true);
    if (typeof score === 'number') set(_todayKey() + '_score', score);
  }

  function getDailyScore() {
    return get(_todayKey() + '_score');
  }

  return { get, set, remove, KEYS, hasDailyPlayedToday, markDailyPlayedToday, getDailyScore };
})();