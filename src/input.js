// input.js — Touch + Mouse Input + Mouse Position Tracking

const Input = (() => {
  let _enabled = true;
  let _tapListeners = [];
  let _moveListeners = [];
  let _cachedRect = null;

  function onTap(fn)  { _tapListeners.push(fn); }
  function onMove(fn) { _moveListeners.push(fn); }

  function clearListeners() {
    _tapListeners = [];
    _moveListeners = [];
  }

  function disable() { _enabled = false; }
  function enable()  { _enabled = true; }

  function _dispatchTap(x, y) {
    if (!_enabled) return;
    _tapListeners.forEach(fn => fn(x, y));
  }

  function _dispatchMove(x, y) {
    _moveListeners.forEach(fn => fn(x, y));
  }

  // ── Page-Scroll Prevention ─────────────────────────────────────────────
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

  // ── Mouse Move ─────────────────────────────────────────────────────────
  window.addEventListener('mousemove', (e) => {
    const rect = _getCanvasRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    _dispatchMove(x, y);
  });

  // ── Mouse Click ────────────────────────────────────────────────────────
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    const rect = _getCanvasRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    _dispatchTap(x, y);
  });

  // ── Touch ──────────────────────────────────────────────────────────────
  window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const rect = _getCanvasRect();
    if (!rect) return;
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    _dispatchMove(x, y);
  }, { passive: false });

  window.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const rect = _getCanvasRect();
    if (!rect) return;
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    _dispatchMove(x, y);
    _dispatchTap(x, y);
  }, { passive: false });

  function _getCanvasRect() {
    if (!_cachedRect) {
      const canvas = document.getElementById('game-canvas');
      if (canvas) _cachedRect = canvas.getBoundingClientRect();
    }
    return _cachedRect;
  }

  window.addEventListener('resize', () => { _cachedRect = null; });

  return { onTap, onMove, clearListeners, disable, enable };
})();