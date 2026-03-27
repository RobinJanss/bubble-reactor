// game.js — State Machine + Game Loop

const Game = (() => {

  const STATE = {
    LOADING:   'LOADING',
    IDLE:      'IDLE',
    PLAYING:   'PLAYING',
    EXPLODING: 'EXPLODING',
    RESULT:    'RESULT',
  };

  const MAX_TAPS = 3;
  const LAUNCHER_RADIUS = 80; // Explosionsradius der Launcher-Bubble

  let _state = STATE.LOADING;
  let _bubbles = [];
  let _boardIndex = 0;
  let _totalScore = 0;
  let _lastResult = null;
  let _isDailyBoard = false;
  let _tapsUsed = 0;
  let _tapsResults = [];
  let _missions = [];
  let _totalStars = 0;

  // Launcher-Bubble Position (folgt der Maus)
  let _launcher = { x: 0, y: 0, visible: false };

  let _canvas = null;
  let _ctx = null;
  let _lastTime = 0;

  // ── Mission Generator ──────────────────────────────────────────────────
  function _generateMissions(boardIndex) {
    const difficulty = Math.min(boardIndex, 8);
    const pool = [
      { id: 'chain5',    label: '5+ Chain',        check: (r) => r.maxChain >= 5   },
      { id: 'chain8',    label: '8+ Chain',         check: (r) => r.maxChain >= 8   },
      { id: 'chain12',   label: '12+ Chain',        check: (r) => r.maxChain >= 12  },
      { id: 'chain18',   label: '18+ Chain',        check: (r) => r.maxChain >= 18  },
      { id: 'score300',  label: '300+ Punkte',      check: (r) => r.totalScore >= 300  },
      { id: 'score600',  label: '600+ Punkte',      check: (r) => r.totalScore >= 600  },
      { id: 'score1000', label: '1000+ Punkte',     check: (r) => r.totalScore >= 1000 },
      { id: 'score2000', label: '2000+ Punkte',     check: (r) => r.totalScore >= 2000 },
      { id: 'mega',      label: 'MEGA Bubble',      check: (r) => r.hitMega           },
      { id: 'taps1',     label: 'Nur 1 Tap',        check: (r) => r.tapsUsed <= 1     },
      { id: 'taps2',     label: 'Max 2 Taps',       check: (r) => r.tapsUsed <= 2     },
      { id: 'multi3',    label: '×3 Multiplikator', check: (r) => r.maxMultiplier >= 3 },
      { id: 'multi5',    label: '×5 Multiplikator', check: (r) => r.maxMultiplier >= 5 },
    ];

    const easy   = [pool[0], pool[4], pool[10], pool[11]];
    const medium = [pool[1], pool[5], pool[8],  pool[11], pool[12]];
    const hard   = [pool[2], pool[6], pool[9],  pool[12]];
    const expert = [pool[3], pool[7]];

    let available = [...easy];
    if (difficulty >= 2) available = [...available, ...medium];
    if (difficulty >= 4) available = [...available, ...hard];
    if (difficulty >= 7) available = [...available, ...expert];

    const rng = Utils.createRNG(Utils.hashString('missions:' + _boardIndex));
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

  function init(canvas) {
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    _resizeCanvas();
    window.addEventListener('resize', _resizeCanvas);

    // Maus-Bewegung → Launcher folgt
    Input.onMove((normX, normY) => {
      _launcher.x = normX * _canvas.width;
      _launcher.y = normY * _canvas.height;
      _launcher.visible = true;
    });

    Input.onTap(_handleTap);
    _totalStars = Storage.get(Storage.KEYS.TOTAL_STARS) || 0;
    requestAnimationFrame(_loop);
  }

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

    if (_state === STATE.IDLE && _canvas.width > 300) _spawnBoard();
  }

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
    }
  }

  function _spawnBoard(daily = false) {
    _isDailyBoard = daily;
    _tapsUsed = 0;
    _tapsResults = [];
    _totalScore = 0;
    _missions = _generateMissions(_boardIndex);

    const seed = daily
      ? Utils.getDailySeed()
      : Utils.hashString('board:' + Date.now());

    _bubbles = Board.generate(seed, _boardIndex, _canvas.width, _canvas.height);
  }

  function _handleTap(normX, normY) {
    if (SDK.isInAd()) return;

    const x = normX * _canvas.width;
    const y = normY * _canvas.height;

    // IDLE → PLAYING
    if (_state === STATE.IDLE) {
      SDK.gameplayStart();
      _state = STATE.PLAYING;
    }

    if (_state === STATE.PLAYING) {
      if (_tapsUsed >= MAX_TAPS) return;

      _tapsUsed++;
      _state = STATE.EXPLODING;

      // Immer von der Launcher-Position aus explodieren
      Explosion.startFromPosition(
        _launcher.x,
        _launcher.y,
        LAUNCHER_RADIUS,
        _bubbles
      );
    }

    if (_state === STATE.RESULT) {
      _boardIndex++;
      _setState(STATE.IDLE);
    }
  }

  function _onChainComplete() {
    const result = {
      score:       Explosion.getScore(),
      chainLength: Explosion.getChainLength(),
      multiplier:  Explosion.getMultiplier(),
      hitMega:     Explosion.hitMega(),
    };

    _tapsResults.push(result);
    _totalScore += result.score;
    _lastResult = result;

    // Missions prüfen ob alle schon erfüllt
    const stats = _getBoardStats();
    _missions.forEach(m => { m.completed = m.check(stats); });
    const allMissionsDone = _missions.every(m => m.completed);

    const idleBubbles = _bubbles.filter(b => b.state === BubbleState.IDLE);
    const tapsLeft = MAX_TAPS - _tapsUsed;

    // Board beenden wenn: alle Missions erfüllt ODER keine Taps mehr ODER keine Bubbles mehr
    if (allMissionsDone || tapsLeft <= 0 || idleBubbles.length === 0) {
      _setState(STATE.RESULT);
    } else {
      _state = STATE.PLAYING;
    }
  }

  function _saveResult() {
    if (_tapsResults.length === 0) return;
    const starsEarned = _checkMissions();
    _totalStars += starsEarned;
    Storage.set(Storage.KEYS.TOTAL_STARS, _totalStars);

    const hs = Storage.get(Storage.KEYS.HIGH_SCORE) || 0;
    if (_totalScore > hs) Storage.set(Storage.KEYS.HIGH_SCORE, _totalScore);

    const bestChain = Math.max(0, ..._tapsResults.map(r => r.chainLength));
    const bc = Storage.get(Storage.KEYS.BEST_CHAIN) || 0;
    if (bestChain > bc) Storage.set(Storage.KEYS.BEST_CHAIN, bestChain);
  }

  function _loop(timestamp) {
    const dt = Math.min(timestamp - _lastTime, 50);
    _lastTime = timestamp;

    if (_state === STATE.EXPLODING) {
      Explosion.update(dt);
      Particles.update(dt);
      if (!Explosion.isActive()) {
        _onChainComplete();
      }
    }

    if (typeof Renderer !== 'undefined') {
      Renderer.draw(_ctx, _canvas, _state, _bubbles, _lastResult, {
        totalScore:   _totalScore,
        chainLength:  Explosion.getChainLength(),
        multiplier:   Explosion.getMultiplier(),
        boardIndex:   _boardIndex,
        isDailyBoard: _isDailyBoard,
        tapsUsed:     _tapsUsed,
        tapsMax:      MAX_TAPS,
        tapsResults:  _tapsResults,
        missions:     _missions,
        totalStars:   _totalStars,
        launcher:     _launcher,
        launcherRadius: LAUNCHER_RADIUS,
      });
    }

    requestAnimationFrame(_loop);
  }

  function getState()   { return _state; }
  function getBubbles() { return _bubbles; }
  function start()      { _setState(STATE.IDLE); }

  return { init, start, getState, getBubbles, STATE };
})();