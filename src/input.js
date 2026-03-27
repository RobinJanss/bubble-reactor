// input.js — Touch + Mouse Input Handler
// Verhindert außerdem dass das Spiel die Poki-Seite scrollt.

const Input = (() => {
  let _enabled = true;
  let _listeners = [];  // Registrierte Tap-Handler

  // Einen Tap/Click-Handler registrieren
  function onTap(fn) {
    _listeners.push(fn);
  }

  // Alle Handler entfernen (z.B. beim State-Wechsel)
  function clearListeners() {
    _listeners = [];
  }

  function disable() { _enabled = false; }
  function enable()  { _enabled = true; }

  // Interner Dispatcher — ruft alle registrierten Handler auf
  function _dispatch(x, y) {
    if (!_enabled) return;
    _listeners.forEach(fn => fn(x, y));
  }

  // ── Page-Scroll Prevention ─────────────────────────────────────────────
  // Poki bettet das Spiel in eine scrollbare Seite ein.
  // Wir verhindern, dass Tastatur/Mausrad/Touch die Seite scrollen.

  function _shouldBlockKey(e) {
    const tag = (e.target?.tagName || '').toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || e.target?.isContentEditable;
    if (isTyping) return false;
    return ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key);
  }

  window.addEventListener('keydown', (e) => {
    if (_shouldBlockKey(e)) e.preventDefault();
  }, { capture: true });

  window.addEventListener('wheel', (e) => {
    e.preventDefault();
  }, { passive: false });

  // ── Mouse Input ────────────────────────────────────────────────────────
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Nur linke Maustaste
    const rect = _getCanvasRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    _dispatch(x, y);
  });

  // ── Touch Input ────────────────────────────────────────────────────────
  window.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Verhindert Ghost-Clicks und Page-Scroll
    const touch = e.touches[0];
    if (!touch) return;
    const rect = _getCanvasRect();
    if (!rect) return;
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    _dispatch(x, y);
  }, { passive: false });

  // Canvas-Rect cachen (wird bei Resize aktualisiert)
  let _cachedRect = null;
  function _getCanvasRect() {
    if (!_cachedRect) {
      const canvas = document.getElementById('game-canvas');
      if (canvas) _cachedRect = canvas.getBoundingClientRect();
    }
    return _cachedRect;
  }

  // Bei Resize den Cache leeren
  window.addEventListener('resize', () => {
    _cachedRect = null;
  });

  return { onTap, clearListeners, disable, enable };
})();