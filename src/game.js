// game.js — State Machine + Game Loop
// Verbindet alle Module. Kein anderes Modul darf den State direkt ändern.

const Game = (() => {

  // ── States ─────────────────────────────────────────────────────────────
  const STATE = {
    LOADING:   'LOADING',
    IDLE:      'IDLE',
    PLAYING:   'PLAYING',
    EXPLODING: 'EXPLODING',
    RESULT:    'RESULT',
  };

  let _state = STATE.LOADING;
  let _bubbles = [];
  let _boardIndex = 0;
  let _totalScore = 0;
  let _lastResult = null;
  let _isDailyBoard = false;

  // Canvas Referenz
  let _canvas = null;
  let _ctx = null;

  // Timing
  let _lastTime = 0;

  // ── Init ───────────────────────────────────────────────────────────────
  function init(canvas) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');

    _resizeCanvas();
    window.addEventListener('resize', _resizeCanvas);

    // Input-Handler registrieren
    Input.onTap(_handleTap);

    // Game Loop starten
    requestAnimationFrame(_loop);
  }

  // ── Canvas Resize — hält 16:9 auf allen Geräten ────────────────────────
  function _resizeCanvas() {
    const targetRatio = 16 / 9;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const winRatio = winW / winH;

    let w, h;
    if (winRatio > targetRatio) {
      h = winH;
      w = h * targetRatio;
    } else {
      w = winW;
      h = w / targetRatio;
    }

    _canvas.width  = Math.floor(w);
    _canvas.height = Math.floor(h);
    _canvas.style.width  = Math.floor(w) + 'px';
    _canvas.style.height = Math.floor(h) + 'px';
  }

  // ── State Transitions ──────────────────────────────────────────────────
  function _setState(newState) {
    _state = newState;

    switch (newState) {
      case STATE.IDLE:
        SDK.gameplayStop();
        _spawnBoard();
        break;

      case STATE.PLAYING:
        // gameplayStart wird beim ersten Input gefeuert — nicht hier
        break;

      case STATE.EXPLODING:
        // Kein SDK Event — Chain läuft intern ab
        break;

      case STATE.RESULT:
        SDK.gameplayStop();
        _saveResult();
        // Alle paar Boards einen Commercial Break einlegen
        if (_boardIndex > 0 && _boardIndex % 3 === 0) {
          SDK.commercialBreak(() => _setState(STATE.IDLE));
        }
        break;
    }
  }

  // ── Board spawnen ──────────────────────────────────────────────────────
  function _spawnBoard(daily = false) {
    _isDailyBoard = daily;
    const seed = daily
      ? Utils.getDailySeed()
      : Utils.hashString('board:' + Date.now());

    _bubbles = Board.generate(seed, _boardIndex, _canvas.width, _canvas.height);
    _totalScore = 0;
  }

  // ── Input Handler ──────────────────────────────────────────────────────
  function _handleTap(normX, normY) {
    if (SDK.isInAd()) return;

    const x = normX * _canvas.width;
    const y = normY * _canvas.height;

    if (_state === STATE.IDLE || _state === STATE.PLAYING) {
      // Erste Interaktion → gameplayStart
      if (_state === STATE.IDLE) {
        SDK.gameplayStart();
        _setState(STATE.PLAYING);
      }

      // Getroffene Bubble suchen
      const hit = _bubbles.find(b =>
        b.state === BubbleState.IDLE && b.containsPoint(x, y)
      );

      if (hit) {
        _setState(STATE.EXPLODING);
        Explosion.start(hit, _bubbles, _onChainComplete);
      }
    }

    if (_state === STATE.RESULT) {
      // Tap auf Result-Screen → nächstes Board
      _boardIndex++;
      _setState(STATE.IDLE);
    }
  }

  // ── Chain abgeschlossen ────────────────────────────────────────────────
  function _onChainComplete(result) {
    _lastResult = result;
    _totalScore += result.score;
    _setState(STATE.RESULT);
  }

  // ── Ergebnis speichern ─────────────────────────────────────────────────
  function _saveResult() {
    if (!_lastResult) return;

    const hs = Storage.get(Storage.KEYS.HIGH_SCORE) || 0;
    if (_totalScore > hs) {
      Storage.set(Storage.KEYS.HIGH_SCORE, _totalScore);
    }

    const bc = Storage.get(Storage.KEYS.BEST_CHAIN) || 0;
    if (_lastResult.chainLength > bc) {
      Storage.set(Storage.KEYS.BEST_CHAIN, _lastResult.chainLength);
    }
  }

  // ── Game Loop ──────────────────────────────────────────────────────────
  function _loop(timestamp) {
    const dt = Math.min(timestamp - _lastTime, 50); // Max 50ms (Tab-Wechsel)
    _lastTime = timestamp;

    // Update
    if (_state === STATE.EXPLODING) {
      Explosion.update(dt);
      if (!Explosion.isActive()) {
        _setState(STATE.RESULT);
      }
    }

    // Render
    if (typeof Renderer !== 'undefined') {
      Renderer.draw(_ctx, _canvas, _state, _bubbles, _lastResult, {
        totalScore: _totalScore,
        chainLength: Explosion.getChainLength(),
        multiplier: Explosion.getMultiplier(),
        boardIndex: _boardIndex,
        isDailyBoard: _isDailyBoard,
      });
    }

    requestAnimationFrame(_loop);
  }

  // ── Public API ─────────────────────────────────────────────────────────
  function getState() { return _state; }
  function getBubbles() { return _bubbles; }

  // Wird von main.js aufgerufen wenn SDK+Assets fertig
  function start() {
    _setState(STATE.IDLE);
  }

  return { init, start, getState, getBubbles, STATE };
})();