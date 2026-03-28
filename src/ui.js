// ui.js — Button-Registry, Hit-Testing, Result-Button-Definitionen, HUD-Helpers
//
// Ladereihenfolge in index.html: ui.js muss VOR renderer.js stehen.
//
// Verantwortlichkeiten:
//   • Zentrale Button-Registry für alle Canvas-Klick-Targets
//   • Entscheidung welche Buttons im Result-Screen sichtbar sind
//   • Formatierungs-Helpers für Score, Chain, Sterne, Streak
//
// renderer.js zeichnet die Buttons, registriert sie hier per UI.register().
// game.js fragt per UI.getHit(cx, cy) ab welcher Button getroffen wurde.

const UI = (() => {

  // ── Button Registry ─────────────────────────────────────────────────────
  // Jeder _drawButton()-Aufruf in renderer.js ruft UI.register() auf.
  // _clearButtons() am Anfang jedes Frames verhindert Anhäufung alter Bounds.

  let _buttons = {};

  function register(id, x, y, w, h) {
    _buttons[id] = { x, y, w, h };
  }

  function clear() {
    _buttons = {};
  }

  // Gibt die ID des getroffenen Buttons zurück, oder null.
  function getHit(cx, cy) {
    for (const [id, b] of Object.entries(_buttons)) {
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) return id;
    }
    return null;
  }

  // ── Result-Button Definitionen ──────────────────────────────────────────
  // Zentrale Entscheidung: welche Buttons erscheinen im Result-Screen und in
  // welcher Reihenfolge? renderer.js rendert sie, game.js reagiert auf die IDs.
  //
  // Tutorial-Board (autoNextProgress >= 0): nur "Nächstes Board" + Countdown.
  // Normales Board: volle Button-Reihe je nach Zustand.

  function getResultButtons(info) {
    // Tutorial: minimaler Result-Screen — kein Retry, kein Shop, kein Daily/Weekly.
    // Der Spieler soll einfach weiterspielen, ohne überfordert zu werden.
    if (info.autoNextProgress >= 0) {
      return [
        { id: 'next', label: '▶  Nächstes Board', bg: '#16A34A', glow: '#22C55E' },
      ];
    }

    const btns = [];

    btns.push({ id: 'next', label: '▶  Nächstes Board', bg: '#16A34A', glow: '#22C55E' });

    if (!info.retryUsed) {
      btns.push({ id: 'retry', label: '▶  Nochmal (Werbung)', bg: '#B45309', glow: '#F59E0B' });
    }

    btns.push({ id: 'shop', label: '🛒  Upgrade Shop', bg: '#6D28D9', glow: '#8B5CF6' });

    if (!info.dailyPlayedToday) {
      btns.push({ id: 'daily', label: '📅  Daily Board', bg: '#4338CA', glow: '#6366F1' });
    }

    if (!info.weeklyPlayedThisWeek) {
      const icon  = info.weeklyIcon  || '🏆';
      const label = info.weeklyLabel || 'Weekly';
      btns.push({ id: 'weekly', label: `${icon}  ${label}`, bg: '#065F46', glow: '#10B981' });
    }

    return btns;
  }

  // ── Formatierungs-Helpers ───────────────────────────────────────────────
  // Konsistente Darstellung von Spielwerten über alle Render-Kontexte.

  function formatScore(n) {
    return (n || 0).toLocaleString() + ' pts';
  }

  function formatChain(n) {
    return n > 0 ? `${n} CHAIN` : '';
  }

  function formatStars(n) {
    return `★ ${n || 0}`;
  }

  function formatStreak(n) {
    return (n || 0) >= 2 ? `🔥 ${n} Tage Streak` : '';
  }

  function formatHighScore(n) {
    return `Rekord: ${(n || 0).toLocaleString()} pts`;
  }

  return {
    // Button Registry
    register,
    clear,
    getHit,
    // Result Buttons
    getResultButtons,
    // Formatierung
    formatScore,
    formatChain,
    formatStars,
    formatStreak,
    formatHighScore,
  };

})();