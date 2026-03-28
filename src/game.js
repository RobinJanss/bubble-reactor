// game.js — State Machine + Game Loop

const Game = (() => {

  const STATE = {
    LOADING:   'LOADING',
    IDLE:      'IDLE',
    PLAYING:   'PLAYING',
    EXPLODING: 'EXPLODING',
    RESULT:    'RESULT',
    SHOP:      'SHOP',         // ← NEU
  };

  // ── Basis-Konstanten (werden durch Upgrades modifiziert) ───────────────
  const BASE_TAPS            = 3;
  const BASE_LAUNCHER_RADIUS = 80;

  let _state        = STATE.LOADING;
  let _bubbles      = [];
  let _boardIndex   = 0;        // = Level - 1
  let _totalScore   = 0;
  let _lastResult   = null;
  let _isDailyBoard = false;
  let _tapsUsed     = 0;
  let _tapsResults  = [];
  let _missions     = [];
  let _totalStars   = 0;
  let _retryUsed    = false;
  let _currentSeed  = 0;

  // ── Aktive Upgrade-Werte (werden in _refreshUpgrades() berechnet) ──────
  let _launcherRadius = BASE_LAUNCHER_RADIUS;
  let _maxTaps        = BASE_TAPS;
  let _chainDivisor   = 2;
  let _megaRadiusBoost = 0;

  function _refreshUpgrades() {
    const cfg        = Upgrades.getGameConfig(BASE_LAUNCHER_RADIUS, BASE_TAPS);
    _launcherRadius  = cfg.launcherRadius;
    _maxTaps         = cfg.maxTaps;
    _chainDivisor    = cfg.chainDivisor;
    _megaRadiusBoost = cfg.megaRadiusBoost;
  }

  // Launcher-Bubble Position
  let _launcher = { x: 0, y: 0, visible: false };

  let _canvas   = null;
  let _ctx      = null;
  let _lastTime = 0;

  // ── Mission Generator ──────────────────────────────────────────────────
  function _generateMissions(boardIndex) {
    const difficulty = Math.min(boardIndex, 8);
    const pool = [
      { id: 'chain5',    label: '5+ Chain',        check: (r) => r.maxChain >= 5         },
      { id: 'chain8',    label: '8+ Chain',         check: (r) => r.maxChain >= 8         },
      { id: 'chain12',   label: '12+ Chain',        check: (r) => r.maxChain >= 12        },
      { id: 'chain18',   label: '18+ Chain',        check: (r) => r.maxChain >= 18        },
      { id: 'score300',  label: '300+ Punkte',      check: (r) => r.totalScore >= 300     },
      { id: 'score600',  label: '600+ Punkte',      check: (r) => r.totalScore >= 600     },
      { id: 'score1000', label: '1000+ Punkte',     check: (r) => r.totalScore >= 1000    },
      { id: 'score2000', label: '2000+ Punkte',     check: (r) => r.totalScore >= 2000    },
      { id: 'mega',      label: 'MEGA Bubble',      check: (r) => r.hitMega               },
      { id: 'taps1',     label: 'Nur 1 Tap',        check: (r) => r.tapsUsed <= 1         },
      { id: 'taps2',     label: 'Max 2 Taps',       check: (r) => r.tapsUsed <= 2         },
      { id: 'multi3',    label: '×3 Multiplikator', check: (r) => r.maxMultiplier >= 3    },
      { id: 'multi5',    label: '×5 Multiplikator', check: (r) => r.maxMultiplier >= 5    },
    ];

    const easy   = [pool[0], pool[4], pool[10], pool[11]];
    const medium = [pool[1], pool[5], pool[8],  pool[11], pool[12]];
    const hard   = [pool[2], pool[6], pool[9],  pool[12]];
    const expert = [pool[3], pool[7]];

    let available = [...easy];
    if (difficulty >= 2) available = [...available, ...medium];
    if (difficulty >= 4) available = [...available, ...hard];
    if (difficulty >= 7) available = [...available, ...expert];

    const rng      = Utils.createRNG(Utils.hashString('missions:' + boardIndex));
    const shuffled = [...available].sort(() => rng() - 0.5);
    return shuffled.slice(0, 3).map(m => ({ ...m, completed: false }));
  }

  function _getBoardStats() {
    return {
      totalScore:    _totalScore,
      maxChain:      Math.max(0, ..._tapsResults.map(r => r.chainLength)),
      maxMultiplier: Math.max(0, ..._tapsResults.map(r => r.multiplier)),
      tapsUsed:      _tapsUsed,
      hitMega:       _tapsResults.some(r => r.hitMega),
    };
  }

  function _checkMissions() {
    const stats = _getBoardStats();
    _missions.forEach(m => { m.completed = m.check(stats); });
    return _missions.filter(m => m.completed).length;
  }

  // ── Init ───────────────────────────────────────────────────────────────
  function init(canvas) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    _resizeCanvas();
    window.addEventListener('resize', _resizeCanvas);

    Input.onMove((normX, normY) => {
      _launcher.x       = normX * _canvas.width;
      _launcher.y       = normY * _canvas.height;
      _launcher.visible = true;
    });

    Input.onTap(_handleTap);
    _totalStars = Storage.get(Storage.KEYS.TOTAL_STARS) || 0;
    _refreshUpgrades();
    requestAnimationFrame(_loop);
  }

  function _resizeCanvas() {
    const targetRatio = 16 / 9;
    const winW        = window.innerWidth;
    const winH        = window.innerHeight;
    const winRatio    = winW / winH;

    let w, h;
    if (winRatio > targetRatio) {
      h = winH; w = h * targetRatio;
    } else {
      w = winW; h = w / targetRatio;
    }

    _canvas.width        = Math.floor(w);
    _canvas.height       = Math.floor(h);
    _canvas.style.width  = Math.floor(w) + 'px';
    _canvas.style.height = Math.floor(h) + 'px';

    if (_state === STATE.IDLE && _canvas.width > 300) _spawnBoard();
  }

  // ── State Machine ──────────────────────────────────────────────────────
  function _setState(newState) {
    _state = newState;
    switch (newState) {
      case STATE.IDLE:
        SDK.gameplayStop();
        _spawnBoard();
        break;
      case STATE.RESULT:
        SDK.gameplayStop();
        _saveResult();
        if (_boardIndex > 0 && _boardIndex % 3 === 0) {
          SDK.commercialBreak(() => {});
        }
        break;
      case STATE.SHOP:
        SDK.gameplayStop();
        break;
    }
  }

  // ── Board Spawnen ──────────────────────────────────────────────────────
  function _spawnBoard(daily = false) {
    _isDailyBoard = daily;
    _tapsUsed     = 0;
    _tapsResults  = [];
    _totalScore   = 0;
    _retryUsed    = false;
    _missions     = _generateMissions(_boardIndex);
    _refreshUpgrades();   // Upgrades vor jedem Board neu einlesen

    const seed   = daily
      ? Utils.getDailySeed()
      : Utils.hashString('board:' + Date.now());
    _currentSeed = seed;

    // Mega-Radius-Boost aus Upgrade in Bubbles einfließen lassen
    _bubbles = Board.generate(seed, _boardIndex, _canvas.width, _canvas.height, _megaRadiusBoost);
  }

  // ── Retry Board ────────────────────────────────────────────────────────
  function _retryBoard() {
    _tapsUsed    = 0;
    _tapsResults = [];
    _totalScore  = 0;
    _missions    = _generateMissions(_boardIndex);
    _refreshUpgrades();
    _bubbles     = Board.generate(_currentSeed, _boardIndex, _canvas.width, _canvas.height, _megaRadiusBoost);
    SDK.gameplayStart();
    _state = STATE.PLAYING;
  }

  // ── Daily Board ────────────────────────────────────────────────────────
  function _startDailyBoard() {
    if (Storage.hasDailyPlayedToday()) return;
    _boardIndex = 0;
    _spawnBoard(true);
    _state = STATE.IDLE;
  }

  // ── Shop: Kauf verarbeiten ─────────────────────────────────────────────
  function _buyUpgrade(id) {
    const success = Upgrades.buy(id, _totalStars);
    if (success) {
      const cost    = Upgrades.CATALOG.find(u => u.id === id).costPerLevel;
      _totalStars  -= cost;
      Storage.set(Storage.KEYS.TOTAL_STARS, _totalStars);
      _refreshUpgrades();
    }
  }

  // ── Tap Handler ────────────────────────────────────────────────────────
  function _handleTap(normX, normY) {
    if (SDK.isInAd()) return;

    const canvasX = normX * _canvas.width;
    const canvasY = normY * _canvas.height;

    // SHOP-State — Button-Hit-Testing
    if (_state === STATE.SHOP) {
      const hit = Renderer.getHitButton(canvasX, canvasY);
      if (hit === 'shop_back') {
        _boardIndex++;
        _setState(STATE.IDLE);
      } else if (hit && hit.startsWith('buy_')) {
        _buyUpgrade(hit.replace('buy_', ''));
      }
      return;
    }

    // IDLE → PLAYING
    if (_state === STATE.IDLE) {
      SDK.gameplayStart();
      _state = STATE.PLAYING;
      return;
    }

    // PLAYING → EXPLODING
    if (_state === STATE.PLAYING) {
      if (_tapsUsed >= _maxTaps) return;
      _tapsUsed++;
      _state = STATE.EXPLODING;
      Explosion.startFromPosition(
        _launcher.x, _launcher.y,
        _launcherRadius, _bubbles,
        _chainDivisor
      );
      return;
    }

    // RESULT → Buttons
    if (_state === STATE.RESULT) {
      const hit = Renderer.getHitButton(canvasX, canvasY);

      if (hit === 'retry' && !_retryUsed) {
        _retryUsed = true;
        SDK.rewardedBreak(() => { _retryBoard(); });
        return;
      }
      if (hit === 'daily' && !Storage.hasDailyPlayedToday()) {
        _boardIndex++;
        _startDailyBoard();
        return;
      }
      if (hit === 'shop') {
        _setState(STATE.SHOP);
        return;
      }
      // 'next' oder Klick außerhalb → nächstes Board
      _boardIndex++;
      _setState(STATE.IDLE);
    }
  }

  // ── Chain abgeschlossen ────────────────────────────────────────────────
  function _onChainComplete() {
    const result = {
      score:       Explosion.getScore(),
      chainLength: Explosion.getChainLength(),
      multiplier:  Explosion.getMultiplier(),
      hitMega:     Explosion.hitMega(),
    };

    _tapsResults.push(result);
    _totalScore += result.score;
    _lastResult  = result;

    const stats = _getBoardStats();
    _missions.forEach(m => { m.completed = m.check(stats); });
    const allMissionsDone = _missions.every(m => m.completed);
    const idleBubbles     = _bubbles.filter(b => b.state === BubbleState.IDLE);
    const tapsLeft        = _maxTaps - _tapsUsed;

    if (allMissionsDone || tapsLeft <= 0 || idleBubbles.length === 0) {
      _setState(STATE.RESULT);
    } else {
      _state = STATE.PLAYING;
    }
  }

  // ── Ergebnis speichern ─────────────────────────────────────────────────
  function _saveResult() {
    if (_tapsResults.length === 0) return;

    const starsEarned = _checkMissions();
    _totalStars += starsEarned;
    Storage.set(Storage.KEYS.TOTAL_STARS, _totalStars);

    const hs = Storage.get(Storage.KEYS.HIGH_SCORE) || 0;
    if (_totalScore > hs) Storage.set(Storage.KEYS.HIGH_SCORE, _totalScore);

    const bestChain = Math.max(0, ..._tapsResults.map(r => r.chainLength));
    const bc        = Storage.get(Storage.KEYS.BEST_CHAIN) || 0;
    if (bestChain > bc) Storage.set(Storage.KEYS.BEST_CHAIN, bestChain);

    if (_isDailyBoard) Storage.markDailyPlayedToday(_totalScore);
  }

  // ── Game Loop ──────────────────────────────────────────────────────────
  function _loop(timestamp) {
    const dt = Math.min(timestamp - _lastTime, 50);
    _lastTime = timestamp;

    if (_state === STATE.EXPLODING) {
      Explosion.update(dt);
      Particles.update(dt);
      if (!Explosion.isActive()) _onChainComplete();
    }

    if (typeof Renderer !== 'undefined') {
      Renderer.draw(_ctx, _canvas, _state, _bubbles, _lastResult, {
        totalScore:       _totalScore,
        chainLength:      Explosion.getChainLength(),
        multiplier:       Explosion.getMultiplier(),
        level:            _boardIndex + 1,          // ← NEU: Level-Anzeige
        boardIndex:       _boardIndex,
        isDailyBoard:     _isDailyBoard,
        tapsUsed:         _tapsUsed,
        tapsMax:          _maxTaps,
        tapsResults:      _tapsResults,
        missions:         _missions,
        totalStars:       _totalStars,
        launcher:         _launcher,
        launcherRadius:   _launcherRadius,
        retryUsed:        _retryUsed,
        dailyPlayedToday: Storage.hasDailyPlayedToday(),
        upgradeStatus:    Upgrades.getStatus(_totalStars),  // ← NEU: Shop-Daten
      });
    }

    requestAnimationFrame(_loop);
  }

  function getState()   { return _state; }
  function getBubbles() { return _bubbles; }
  function start()      { _setState(STATE.IDLE); }

  return { init, start, getState, getBubbles, STATE };
})();