// game.js — State Machine + Game Loop

const Game = (() => {

  const STATE = {
    LOADING:   'LOADING',
    IDLE:      'IDLE',
    PLAYING:   'PLAYING',
    EXPLODING: 'EXPLODING',
    RESULT:    'RESULT',
    SHOP:      'SHOP',
  };

  const BASE_TAPS            = 3;
  const BASE_LAUNCHER_RADIUS = 80;

  // ── Score-Meilensteine ────────────────────────────────────────────────
  const MILESTONES = [
    { score: 500,    stars: 2,  label: '🔥 Zündung!',              desc: '500 Punkte gesamt' },
    { score: 2000,   stars: 3,  label: '⚡ Kettenreaktor',          desc: '2.000 Punkte gesamt' },
    { score: 5000,   stars: 5,  label: '💥 Überhitzt',             desc: '5.000 Punkte gesamt' },
    { score: 15000,  stars: 8,  label: '☢️ Meltdown',              desc: '15.000 Punkte gesamt' },
    { score: 35000,  stars: 12, label: '🌟 Supernova',             desc: '35.000 Punkte gesamt' },
    { score: 75000,  stars: 20, label: '✦ GALAKTISCH ✦',          desc: '75.000 Punkte gesamt' },
  ];

  // ── Weekly Challenges ─────────────────────────────────────────────────
  const WEEKLY_RULES = [
    {
      id: 'sniper', icon: '🎯', label: 'Sniper Modus',
      desc: 'Nur 1 Tap erlaubt — triff genau!',
      maxTapsOverride: 1,
    },
    {
      id: 'chain_god', icon: '⛓️', label: 'Chain Gott',
      desc: 'Erreiche eine 20+ Chain in einem Tap',
      missionOverride: [{ label: '20+ Chain', check: (r) => r.maxChain >= 20 }],
    },
    {
      id: 'speed_run', icon: '🚀', label: 'Speed Run',
      desc: '500+ Punkte mit maximal 2 Taps',
      missionOverride: [
        { label: '500+ Punkte',  check: (r) => r.totalScore >= 500 },
        { label: 'Max 2 Taps',   check: (r) => r.tapsUsed <= 2     },
      ],
    },
  ];

  function _getWeeklyChallenge() {
    const d    = new Date();
    const jan1 = new Date(d.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    const rule = WEEKLY_RULES[week % WEEKLY_RULES.length];
    const seed = Utils.hashString('weekly:' + d.getUTCFullYear() + week);
    return { ...rule, seed };
  }

  // ── State-Variablen ───────────────────────────────────────────────────
  let _state        = STATE.LOADING;
  let _bubbles      = [];
  let _boardIndex   = 0;
  let _totalScore   = 0;
  let _lastResult   = null;
  let _isDailyBoard = false;
  let _isWeeklyBoard = false;
  let _weeklyRule   = null;
  let _tapsUsed     = 0;
  let _tapsResults  = [];
  let _missions     = [];
  let _totalStars   = 0;
  let _retryUsed    = false;
  let _currentSeed  = 0;

  // ── Upgrade-Werte ──────────────────────────────────────────────────────
  let _cfg = {};

  // ── Overdrive + Combo Keeper ───────────────────────────────────────────
  let _overdrivePending = false;
  let _lastMultiplier   = 1;
  let _precisionHit     = false;

  // ── Adaptive Difficulty ────────────────────────────────────────────────
  let _consecutiveEasyClears = 0;   // Wie oft 1-Tap hintereinander
  let _difficultyBonus       = 0;   // Zusätzlicher Level-Offset für Board-Generierung
  let _adaptiveDiffLabel     = '';  // Anzeige-Text

  // ── Milestone-Toast ────────────────────────────────────────────────────
  let _pendingMilestone  = null;    // { label, stars } für Popup
  let _milestoneTimer    = 0;       // ms bis Popup verschwindet

  // ── Prestige ───────────────────────────────────────────────────────────
  let _prestigeLevel      = 0;
  let _prestigeMultiplier = 1.0;    // Score × (1 + level × 0.25)

  // ── Streak ────────────────────────────────────────────────────────────
  let _currentStreak = 0;

  let _launcher = { x: 0, y: 0, visible: false };
  let _canvas   = null;
  let _ctx      = null;
  let _lastTime = 0;

  // ── Upgrades ──────────────────────────────────────────────────────────
  function _refreshUpgrades() {
    _cfg = Upgrades.getGameConfig(BASE_LAUNCHER_RADIUS, BASE_TAPS);
    if (typeof Particles !== 'undefined') Particles.setAfterburnActive(_cfg.afterburnEnabled);
    _prestigeLevel      = Storage.getPrestigeLevel();
    _prestigeMultiplier = 1 + _prestigeLevel * 0.25;
  }

  // ── Prestige ──────────────────────────────────────────────────────────
  function _doPrestige() {
    // Alle Upgrades resetten
    Upgrades.CATALOG.forEach(u => Storage.remove('br_upg_' + u.id));
    Storage.incrementPrestige();
    _totalStars = 0;
    Storage.set(Storage.KEYS.TOTAL_STARS, 0);
    _refreshUpgrades();
  }

  function _isPrestigeAvailable() {
    return Upgrades.CATALOG.every(u => Upgrades.getLevel(u.id) >= u.maxLevel);
  }

  // ── Mission Generator ─────────────────────────────────────────────────
  function _generateMissions(boardIndex, override = null) {
    if (override) return override.map(m => ({ ...m, completed: false }));

    const difficulty = Math.min(boardIndex, 8);
    const pool = [
      { id: 'chain5',    label: '5+ Chain',        check: (r) => r.maxChain >= 5      },
      { id: 'chain8',    label: '8+ Chain',         check: (r) => r.maxChain >= 8      },
      { id: 'chain12',   label: '12+ Chain',        check: (r) => r.maxChain >= 12     },
      { id: 'chain18',   label: '18+ Chain',        check: (r) => r.maxChain >= 18     },
      { id: 'score300',  label: '300+ Punkte',      check: (r) => r.totalScore >= 300  },
      { id: 'score600',  label: '600+ Punkte',      check: (r) => r.totalScore >= 600  },
      { id: 'score1000', label: '1000+ Punkte',     check: (r) => r.totalScore >= 1000 },
      { id: 'score2000', label: '2000+ Punkte',     check: (r) => r.totalScore >= 2000 },
      { id: 'mega',      label: 'MEGA Bubble',      check: (r) => r.hitMega            },
      { id: 'taps1',     label: 'Nur 1 Tap',        check: (r) => r.tapsUsed <= 1      },
      { id: 'taps2',     label: 'Max 2 Taps',       check: (r) => r.tapsUsed <= 2      },
      { id: 'multi3',    label: '×3 Multiplikator', check: (r) => r.maxMultiplier >= 3 },
      { id: 'multi5',    label: '×5 Multiplikator', check: (r) => r.maxMultiplier >= 5 },
    ];
    const easy = [pool[0], pool[4], pool[10], pool[11]];
    const med  = [pool[1], pool[5], pool[8],  pool[11], pool[12]];
    const hard = [pool[2], pool[6], pool[9],  pool[12]];
    const exp  = [pool[3], pool[7]];
    let avail  = [...easy];
    if (difficulty >= 2) avail = [...avail, ...med];
    if (difficulty >= 4) avail = [...avail, ...hard];
    if (difficulty >= 7) avail = [...avail, ...exp];
    const rng = Utils.createRNG(Utils.hashString('missions:' + boardIndex));
    return [...avail].sort(() => rng() - 0.5).slice(0, 3).map(m => ({ ...m, completed: false }));
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
    const completed = _missions.filter(m => m.completed).length;
    return completed + completed * (_cfg.starBonusPerMission || 0);
  }

  // ── Score-Meilensteine prüfen ─────────────────────────────────────────
  function _checkMilestones(roundScore) {
    const newTotal  = Storage.addToTotalScore(roundScore);
    const reached   = Storage.getMilestonesReached();

    for (let i = 0; i < MILESTONES.length; i++) {
      if (!reached.includes(i) && newTotal >= MILESTONES[i].score) {
        Storage.markMilestoneReached(i);
        _totalStars += MILESTONES[i].stars;
        Storage.set(Storage.KEYS.TOTAL_STARS, _totalStars);
        _pendingMilestone = MILESTONES[i];
        _milestoneTimer   = 4000;   // 4 Sekunden anzeigen
        // Nur den ersten neuen anzeigen
        break;
      }
    }
  }

  // ── Adaptive Difficulty Update ────────────────────────────────────────
  function _updateAdaptiveDifficulty() {
    if (_tapsUsed <= 1 && _totalScore > 100) {
      _consecutiveEasyClears++;
      if (_consecutiveEasyClears >= 3) {
        _difficultyBonus = Math.min(_difficultyBonus + 2, 15);
        _consecutiveEasyClears = 0;
        _adaptiveDiffLabel = `⚡ Schwierigkeit +${_difficultyBonus}`;
      }
    } else {
      _consecutiveEasyClears = 0;
      if (_difficultyBonus > 0) {
        _difficultyBonus = Math.max(0, _difficultyBonus - 1);
      }
      _adaptiveDiffLabel = _difficultyBonus > 0 ? `⚡ +${_difficultyBonus}` : '';
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────
  function init(canvas) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    _resizeCanvas();
    window.addEventListener('resize', _resizeCanvas);
    Input.onMove((normX, normY) => {
      _launcher.x = normX * _canvas.width;
      _launcher.y = normY * _canvas.height;
      _launcher.visible = true;
    });
    Input.onTap(_handleTap);
    _totalStars    = Storage.get(Storage.KEYS.TOTAL_STARS) || 0;
    _currentStreak = Storage.getStreak();
    _refreshUpgrades();
    requestAnimationFrame(_loop);
  }

  function _resizeCanvas() {
    const r = 16 / 9, winW = window.innerWidth, winH = window.innerHeight;
    let w, h;
    if (winW / winH > r) { h = winH; w = h * r; } else { w = winW; h = w / r; }
    _canvas.width = Math.floor(w); _canvas.height = Math.floor(h);
    _canvas.style.width = Math.floor(w) + 'px'; _canvas.style.height = Math.floor(h) + 'px';
    if (_state === STATE.IDLE && _canvas.width > 300) _spawnBoard();
  }

  // ── State Machine ─────────────────────────────────────────────────────
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
        if (_boardIndex > 0 && _boardIndex % 3 === 0) SDK.commercialBreak(() => {});
        break;
      case STATE.SHOP:
        SDK.gameplayStop();
        break;
    }
  }

  // ── Board Spawnen ─────────────────────────────────────────────────────
  function _spawnBoard(daily = false, weekly = false) {
    _isDailyBoard      = daily;
    _isWeeklyBoard     = weekly;
    _weeklyRule        = weekly ? _getWeeklyChallenge() : null;
    _tapsUsed          = 0;
    _tapsResults       = [];
    _totalScore        = 0;
    _retryUsed         = false;
    _overdrivePending  = false;
    _lastMultiplier    = 1;
    _refreshUpgrades();

    const maxTapsOverride = _weeklyRule?.maxTapsOverride;
    if (maxTapsOverride) _cfg.maxTaps = maxTapsOverride;

    _missions = _generateMissions(
      _boardIndex,
      _weeklyRule?.missionOverride || null
    );

    let seed;
    if (daily)        seed = Utils.getDailySeed();
    else if (weekly)  seed = _weeklyRule.seed;
    else              seed = Utils.hashString('board:' + Date.now());

    _currentSeed = seed;
    const effectiveDifficulty = _boardIndex + _difficultyBonus;
    _bubbles = Board.generate(seed, effectiveDifficulty, _canvas.width, _canvas.height, _cfg);
  }

  // ── Retry ─────────────────────────────────────────────────────────────
  function _retryBoard() {
    _tapsUsed = 0; _tapsResults = []; _totalScore = 0;
    _overdrivePending = false; _lastMultiplier = 1;
    _missions = _generateMissions(_boardIndex, _weeklyRule?.missionOverride || null);
    _refreshUpgrades();
    const effectiveDifficulty = _boardIndex + _difficultyBonus;
    _bubbles = Board.generate(_currentSeed, effectiveDifficulty, _canvas.width, _canvas.height, _cfg);
    SDK.gameplayStart();
    _state = STATE.PLAYING;
  }

  // ── Shop ──────────────────────────────────────────────────────────────
  function _buyUpgrade(id) {
    const def = Upgrades.CATALOG.find(u => u.id === id);
    if (!def) return;
    if (Upgrades.buy(id, _totalStars)) {
      _totalStars -= def.costPerLevel;
      Storage.set(Storage.KEYS.TOTAL_STARS, _totalStars);
      _refreshUpgrades();
    }
  }

  // ── Explosion starten ─────────────────────────────────────────────────
  function _startExplosion() {
    let launchR = _cfg.launcherRadius;
    if (_cfg.overdriveEnabled && _overdrivePending) {
      launchR = Math.round(launchR * 1.5);
      _overdrivePending = false;
      if (typeof Renderer !== 'undefined') { Renderer.triggerFlash(0.25); Renderer.triggerShake(6, 10); }
    }

    const startMultiplier = _cfg.comboKeeperEnabled && _tapsUsed > 1
      ? Math.max(1, Math.floor(_lastMultiplier / 2)) : 1;

    _precisionHit = false;
    if (_cfg.precisionBonus > 0) {
      _precisionHit = _bubbles.some(b => {
        if (b.state !== BubbleState.IDLE || b.locked) return false;
        return Utils.distance(_launcher.x, _launcher.y, b.x, b.y) <= launchR + b.radius
          && b.type.name === 'MEGA';
      });
    }

    Explosion.startFromPosition(_launcher.x, _launcher.y, launchR, _bubbles, {
      chainDivisor: _cfg.chainDivisor,
      infernoStep:  _cfg.chainInfernoStep,
      highRollerFactor: _cfg.highRollerFactor,
      startMultiplier,
    });
  }

  // ── Tap Handler ───────────────────────────────────────────────────────
  function _handleTap(normX, normY) {
    if (SDK.isInAd()) return;
    const canvasX = normX * _canvas.width;
    const canvasY = normY * _canvas.height;

    if (_state === STATE.SHOP) {
      const hit = Renderer.getHitButton(canvasX, canvasY);
      if (hit === 'shop_back')        { _boardIndex++; _setState(STATE.IDLE); }
      else if (hit === 'prestige')     { _doPrestige(); }
      else if (hit?.startsWith('buy_')) _buyUpgrade(hit.replace('buy_', ''));
      return;
    }

    if (_state === STATE.IDLE) { SDK.gameplayStart(); _state = STATE.PLAYING; return; }

    if (_state === STATE.PLAYING) {
      if (_tapsUsed >= _cfg.maxTaps) return;
      _tapsUsed++;
      _state = STATE.EXPLODING;
      _startExplosion();
      return;
    }

    if (_state === STATE.RESULT) {
      const hit = Renderer.getHitButton(canvasX, canvasY);
      if (hit === 'retry' && !_retryUsed) {
        _retryUsed = true;
        SDK.rewardedBreak(() => { _retryBoard(); });
        return;
      }
      if (hit === 'daily' && !Storage.hasDailyPlayedToday()) {
        _boardIndex++; _spawnBoard(true); _state = STATE.IDLE; return;
      }
      if (hit === 'weekly' && !Storage.hasWeeklyPlayedThisWeek()) {
        _spawnBoard(false, true); _state = STATE.IDLE; return;
      }
      if (hit === 'shop') { _setState(STATE.SHOP); return; }
      _boardIndex++; _setState(STATE.IDLE);
    }
  }

  // ── Chain abgeschlossen ───────────────────────────────────────────────
  function _onChainComplete() {
    let score      = Explosion.getScore();
    const chainLen = Explosion.getChainLength();
    const mult     = Explosion.getMultiplier();
    const mega     = Explosion.hitMega();

    // Präzisions-Bonus
    if (_precisionHit && _cfg.precisionBonus > 0) {
      score = Math.round(score * (1 + _cfg.precisionBonus));
      _precisionHit = false;
      if (typeof Renderer !== 'undefined') Renderer.triggerFlash(0.2);
    }

    // Prestige-Multiplikator
    score = Math.round(score * _prestigeMultiplier);

    const result = { score, chainLength: chainLen, multiplier: mult, hitMega: mega };
    _tapsResults.push(result);
    _totalScore    += score;
    _lastResult     = result;
    _lastMultiplier = mult;

    if (_cfg.overdriveEnabled && chainLen >= 10) _overdrivePending = true;

    const stats = _getBoardStats();
    _missions.forEach(m => { m.completed = m.check(stats); });
    const allDone  = _missions.every(m => m.completed);
    const tapsLeft = _cfg.maxTaps - _tapsUsed;
    const idleBubs = _bubbles.filter(b => b.state === BubbleState.IDLE && !b.locked);

    if (allDone || tapsLeft <= 0 || idleBubs.length === 0) {
      _setState(STATE.RESULT);
    } else {
      _state = STATE.PLAYING;
    }
  }

  // ── Ergebnis speichern ────────────────────────────────────────────────
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

    if (_isDailyBoard) {
      _currentStreak = Storage.getAndUpdateStreak();
      Storage.markDailyPlayedToday(_totalScore);
      // 7-Tage Streak Bonus
      if (_currentStreak > 0 && _currentStreak % 7 === 0) {
        _totalStars += 5;
        Storage.set(Storage.KEYS.TOTAL_STARS, _totalStars);
        _pendingMilestone = { label: '🔥 7-Tage Streak!', stars: 5, desc: 'Täglich spielen zahlt sich aus' };
        _milestoneTimer   = 4000;
      }
    }

    if (_isWeeklyBoard) Storage.markWeeklyPlayedThisWeek(_totalScore);

    _updateAdaptiveDifficulty();
    _checkMilestones(_totalScore);
  }

  // ── Game Loop ─────────────────────────────────────────────────────────
  function _loop(timestamp) {
    const dt = Math.min(timestamp - _lastTime, 50);
    _lastTime = timestamp;

    if (_state === STATE.EXPLODING) {
      Explosion.update(dt);
      Particles.update(dt);
      if (!Explosion.isActive()) _onChainComplete();
    }

    if (_milestoneTimer > 0) _milestoneTimer -= dt;
    if (_milestoneTimer <= 0 && _milestoneTimer > -100) { _pendingMilestone = null; _milestoneTimer = -200; }

    const weekly = _getWeeklyChallenge();

    if (typeof Renderer !== 'undefined') {
      Renderer.draw(_ctx, _canvas, _state, _bubbles, _lastResult, {
        totalScore:          _totalScore,
        chainLength:         Explosion.getChainLength(),
        multiplier:          Explosion.getMultiplier(),
        level:               _boardIndex + 1,
        boardIndex:          _boardIndex,
        isDailyBoard:        _isDailyBoard,
        isWeeklyBoard:       _isWeeklyBoard,
        weeklyLabel:         weekly.label,
        weeklyIcon:          weekly.icon,
        weeklyPlayedThisWeek: Storage.hasWeeklyPlayedThisWeek(),
        tapsUsed:            _tapsUsed,
        tapsMax:             _cfg.maxTaps || BASE_TAPS,
        tapsResults:         _tapsResults,
        missions:            _missions,
        totalStars:          _totalStars,
        launcher:            _launcher,
        launcherRadius:      _cfg.launcherRadius || BASE_LAUNCHER_RADIUS,
        retryUsed:           _retryUsed,
        dailyPlayedToday:    Storage.hasDailyPlayedToday(),
        upgradeStatus:       Upgrades.getStatus(_totalStars),
        overdrivePending:    _overdrivePending,
        trailEnabled:        _cfg.trailEnabled,
        prestigeLevel:       _prestigeLevel,
        prestigeAvailable:   _isPrestigeAvailable(),
        currentStreak:       _currentStreak,
        difficultyBonus:     _difficultyBonus,
        adaptiveDiffLabel:   _adaptiveDiffLabel,
        pendingMilestone:    _milestoneTimer > 0 ? _pendingMilestone : null,
        totalScoreAllTime:   Storage.getTotalScore(),
        milestones:          MILESTONES,
        milestonesReached:   Storage.getMilestonesReached(),
      });
    }

    requestAnimationFrame(_loop);
  }

  function getState()   { return _state; }
  function getBubbles() { return _bubbles; }
  function start()      { _setState(STATE.IDLE); }

  return { init, start, getState, getBubbles, STATE };
})();