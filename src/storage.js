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
    DAILY_PLAYED: 'br_daily_played',
    DAILY_SCORE:  'br_daily_score',
    TOTAL_STARS:  'br_total_stars',   // ← neu
  };

  return { get, set, remove, KEYS };
})();