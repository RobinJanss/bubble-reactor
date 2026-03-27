// utils.js — Seeded RNG, Math-Helpers, Daily-Seed

const Utils = (() => {

  // ── Seeded Pseudo-RNG (Mulberry32) ─────────────────────────────────────
  // Gleicher Seed → immer gleiche Zufallsfolge → reproduzierbare Boards
  function createRNG(seed) {
    let s = seed >>> 0;
    return function () {
      s += 0x6D2B79F5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── Hash-Funktion (FNV-1a) ─────────────────────────────────────────────
  // Wandelt einen String in einen stabilen Integer um
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ── Daily Seed ─────────────────────────────────────────────────────────
  // Gleiches Board für alle Spieler am selben Tag — kein Server nötig
  function getDailySeed() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return hashString('br_daily:' + y + m + d);
  }

  // ── Math Helpers ───────────────────────────────────────────────────────
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function distance(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Zufällige Ganzzahl zwischen min (inkl) und max (inkl)
  function randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  // Zufälliges Element aus einem Array
  function randPick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  return {
    createRNG,
    hashString,
    getDailySeed,
    clamp,
    lerp,
    distance,
    randInt,
    randPick,
  };
})();