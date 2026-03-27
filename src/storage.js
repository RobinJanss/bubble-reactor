// storage.js — Incognito-safe localStorage Wrapper
// Im Incognito-Modus kann localStorage eingeschränkt oder gesperrt sein.
// ALLE Zugriffe gehen über dieses Modul — niemals direkter localStorage-Zugriff.

const Storage = (() => {

  function get(key) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : null;
    } catch (e) {
      // Incognito oder localStorage gesperrt → null zurückgeben
      return null;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // Speichern fehlgeschlagen → false, aber kein Crash
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

  // Spezifische Game-Keys — zentral definiert, nie als Magic Strings
  const KEYS = {
    HIGH_SCORE:      'br_highscore',
    BEST_CHAIN:      'br_bestchain',
    DAILY_PLAYED:    'br_daily_played',   // Datum des letzten Daily Boards
    DAILY_SCORE:     'br_daily_score',
  };

  return { get, set, remove, KEYS };
})();