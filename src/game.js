// game.js — State Machine + Game Loop

const Game = (() => {

  const STATE = {
    LOADING: 'LOADING', IDLE: 'IDLE', PLAYING: 'PLAYING',
    EXPLODING: 'EXPLODING', RESULT: 'RESULT', SHOP: 'SHOP',
  };

  const BASE_TAPS            = 3;
  const BASE_LAUNCHER_RADIUS = 80;
  const _AUTO_NEXT_DURATION  = 2500;

  const PRESTIGE_UNLOCKS = [
    { level: 1,  id: 'gold_theme',     icon: '🎨', label: 'Gold Theme',        desc: 'Alles glänzt in Gold',                 type: 'visual'   },
    { level: 2,  id: 'void_bubble',    icon: '🌀', label: 'Void Bubble',        desc: 'Ultra-seltene Mega-Bubble (500 Punkte)',type: 'gameplay' },
    { level: 3,  id: 'deep_sea_bg',    icon: '🌊', label: 'Tiefsee Theme',      desc: 'Dunkle Tiefsee-Atmosphäre',            type: 'visual'   },
    { level: 4,  id: 'resonance',      icon: '🔗', label: 'Resonanz',           desc: '100% Multiplikator-Übertrag',          type: 'gameplay' },
    { level: 5,  id: 'plasma_theme',   icon: '⚡', label: 'Plasma Theme',       desc: 'Neon-Pink Partikel & Glow',            type: 'visual'   },
    { level: 6,  id: 'crown_launcher', icon: '👑', label: 'Kronen-Launcher',    desc: 'Spezieller Launcher-Look',             type: 'visual'   },
    { level: 7,  id: 'slow_motion',    icon: '⏳', label: 'Zeitlupe',           desc: '1× pro Board: Explosion verlangsamen', type: 'gameplay' },
    { level: 8,  id: 'void_bg',        icon: '🌌', label: 'Void Hintergrund',   desc: 'Weltraum-Dunkelheit',                  type: 'visual'   },
    { level: 9,  id: 'hardcore',       icon: '💎', label: 'Hardcore Mode',      desc: 'Keine Upgrades, 5× Score',             type: 'mode'     },
    { level: 10, id: 'reactor_god',    icon: '✦',  label: 'Reaktor-Gott',       desc: 'Alle Effekte + Rainbow-Glow',          type: 'special'  },
  ];

  function _getPrestigeUnlock(prestigeLevel) {
    return PRESTIGE_UNLOCKS.filter(u => u.level <= prestigeLevel).map(u => u.id);
  }
  function _hasUnlock(prestigeLevel, id) {
    return _getPrestigeUnlock(prestigeLevel).includes(id);
  }
  function _getActiveTheme(prestigeLevel) {
    if (prestigeLevel >= 10) return 'reactor_god';
    if (prestigeLevel >= 8)  return 'void';
    if (prestigeLevel >= 5)  return 'plasma';
    if (prestigeLevel >= 3)  return 'deep_sea';
    if (prestigeLevel >= 1)  return 'gold';
    return 'default';
  }

  const MILESTONES = [
    { score: 500,   stars: 2,  label: '🔥 Zündung!',     desc: '500 Punkte gesamt'    },
    { score: 2000,  stars: 3,  label: '⚡ Kettenreaktor', desc: '2.000 Punkte gesamt'  },
    { score: 5000,  stars: 5,  label: '💥 Überhitzt',    desc: '5.000 Punkte gesamt'  },
    { score: 15000, stars: 8,  label: '☢️ Meltdown',     desc: '15.000 Punkte gesamt' },
    { score: 35000, stars: 12, label: '🌟 Supernova',    desc: '35.000 Punkte gesamt' },
    { score: 75000, stars: 20, label: '✦ GALAKTISCH',    desc: '75.000 Punkte gesamt' },
  ];

  const WEEKLY_RULES = [
    { id: 'sniper',    icon: '🎯', label: 'Sniper Modus', desc: 'Nur 1 Tap erlaubt',      maxTapsOverride: 1 },
    { id: 'chain_god', icon: '⛓️', label: 'Chain Gott',   desc: 'Erreiche 20+ Chain',      missionOverride: [{ label: '20+ Chain', check: r => r.maxChain >= 20 }] },
    { id: 'speed_run', icon: '🚀', label: 'Speed Run',    desc: '500+ Punkte, max 2 Taps', missionOverride: [{ label: '500+ Punkte', check: r => r.totalScore >= 500 }, { label: 'Max 2 Taps', check: r => r.tapsUsed <= 2 }] },
  ];

  function _getWeeklyChallenge() {
    const d = new Date(), jan1 = new Date(d.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
    const rule = WEEKLY_RULES[week % WEEKLY_RULES.length];
    return { ...rule, seed: Utils.hashString('weekly:' + d.getUTCFullYear() + week) };
  }

  let _state = STATE.LOADING, _bubbles = [], _boardIndex = 0;
  let _totalScore = 0, _lastResult = null;
  let _isDailyBoard = false, _isWeeklyBoard = false, _weeklyRule = null;
  let _tapsUsed = 0, _tapsResults = [], _missions = [], _totalStars = 0;
  let _retryUsed = false, _currentSeed = 0, _cfg = {};

  let _prestigeLevel = 0, _prestigeMultiplier = 1.0;
  let _overdrivePending = false, _lastMultiplier = 1, _precisionHit = false;
  let _consecutiveEasyClears = 0, _difficultyBonus = 0, _adaptiveDiffLabel = '';
  let _hardcoreMode = false;
  let _slowMotionAvailable = false, _slowMotionActive = false, _slowMotionUsed = false;
  let _pendingMilestone = null, _milestoneTimer = 0;
  let _pendingPrestigeUnlock = null, _prestigeUnlockTimer = 0;
  let _currentStreak = 0;

  let _tutorialDone    = false;
  let _isTutorialBoard = false;
  let _autoNextTimer   = -1;

  // ── Canvas Scale ──────────────────────────────────────────────────────
  // Max = 1.0: Desktop bleibt auf Original-Werten (kalibriert für 836px).
  // Nur Mobile (< 836px) wird nach unten skaliert.
  let _scale = 1;

  let _launcher = { x: 0, y: 0, visible: false };
  let _canvas = null, _ctx = null, _lastTime = 0;

  function _refreshUpgrades() {
    _prestigeLevel      = Storage.getPrestigeLevel();
    _prestigeMultiplier = 1 + _prestigeLevel * 0.25;
    if (_hardcoreMode && _prestigeLevel >= 9) {
      _cfg = Upgrades.getGameConfig(BASE_LAUNCHER_RADIUS, BASE_TAPS);
      _cfg.launcherRadius    = BASE_LAUNCHER_RADIUS;
      _cfg.maxTaps           = BASE_TAPS;
      _cfg.chainDivisor      = 2;
      _cfg.reactionBoost     = 0;
      _cfg.megaRadiusBoost   = 0;
      _cfg.bubbleMagnetBoost = 0;
    } else {
      _cfg = Upgrades.getGameConfig(BASE_LAUNCHER_RADIUS, BASE_TAPS);
    }
    _cfg.prestigeLevel   = _prestigeLevel;
    _slowMotionAvailable = _prestigeLevel >= 7;
    if (typeof Particles !== 'undefined') Particles.setAfterburnActive(_cfg.afterburnEnabled);
  }

  function _doPrestige() {
    Upgrades.CATALOG.forEach(u => Storage.remove('br_upg_' + u.id));
    const newLevel = Storage.incrementPrestige();
    _totalStars = 0;
    Storage.set(Storage.KEYS.TOTAL_STARS, 0);
    _hardcoreMode = false;
    _refreshUpgrades();
    const unlock = PRESTIGE_UNLOCKS.find(u => u.level === newLevel);
    if (unlock) { _pendingPrestigeUnlock = unlock; _prestigeUnlockTimer = 5000; }
  }

  function _isPrestigeAvailable() {
    return Upgrades.CATALOG.every(u => Upgrades.getLevel(u.id) >= u.maxLevel);
  }

  function _generateMissions(boardIndex, override = null) {
    if (override) return override.map(m => ({ ...m, completed: false }));
    const difficulty = Math.min(boardIndex, 8);
    const pool = [
      { id: 'chain5',    label: '5+ Chain',        check: r => r.maxChain >= 5        },
      { id: 'chain8',    label: '8+ Chain',         check: r => r.maxChain >= 8        },
      { id: 'chain12',   label: '12+ Chain',        check: r => r.maxChain >= 12       },
      { id: 'chain18',   label: '18+ Chain',        check: r => r.maxChain >= 18       },
      { id: 'score300',  label: '300+ Punkte',      check: r => r.totalScore >= 300    },
      { id: 'score600',  label: '600+ Punkte',      check: r => r.totalScore >= 600    },
      { id: 'score1000', label: '1000+ Punkte',     check: r => r.totalScore >= 1000   },
      { id: 'score2000', label: '2000+ Punkte',     check: r => r.totalScore >= 2000   },
      { id: 'mega',      label: 'MEGA Bubble',      check: r => r.hitMega              },
      { id: 'taps1',     label: 'Nur 1 Tap',        check: r => r.tapsUsed <= 1        },
      { id: 'taps2',     label: 'Max 2 Taps',       check: r => r.tapsUsed <= 2        },
      { id: 'multi3',    label: '×3 Multiplikator', check: r => r.maxMultiplier >= 3   },
      { id: 'multi5',    label: '×5 Multiplikator', check: r => r.maxMultiplier >= 5   },
    ];
    const easy=[pool[0],pool[4],pool[10],pool[11]], med=[pool[1],pool[5],pool[8],pool[11],pool[12]];
    const hard=[pool[2],pool[6],pool[9],pool[12]], exp=[pool[3],pool[7]];
    let avail=[...easy];
    if(difficulty>=2) avail=[...avail,...med];
    if(difficulty>=4) avail=[...avail,...hard];
    if(difficulty>=7) avail=[...avail,...exp];
    const rng=Utils.createRNG(Utils.hashString('missions:'+boardIndex));
    return [...avail].sort(()=>rng()-.5).slice(0,3).map(m=>({...m,completed:false}));
  }

  function _getBoardStats() {
    return {
      totalScore:    _totalScore,
      maxChain:      Math.max(0,..._tapsResults.map(r=>r.chainLength)),
      maxMultiplier: Math.max(0,..._tapsResults.map(r=>r.multiplier)),
      tapsUsed:      _tapsUsed,
      hitMega:       _tapsResults.some(r=>r.hitMega),
    };
  }

  function _checkMissions() {
    const stats=_getBoardStats();
    _missions.forEach(m=>{m.completed=m.check(stats);});
    const done=_missions.filter(m=>m.completed).length;
    return done + done*(_cfg.starBonusPerMission||0);
  }

  function _checkMilestones(score) {
    const total=Storage.addToTotalScore(score);
    const reached=Storage.getMilestonesReached();
    for (let i=0;i<MILESTONES.length;i++) {
      if (!reached.includes(i) && total>=MILESTONES[i].score) {
        Storage.markMilestoneReached(i);
        _totalStars+=MILESTONES[i].stars;
        Storage.set(Storage.KEYS.TOTAL_STARS,_totalStars);
        _pendingMilestone=MILESTONES[i]; _milestoneTimer=4000;
        break;
      }
    }
  }

  function _updateAdaptiveDifficulty() {
    if (_tapsUsed<=1 && _totalScore>100) {
      _consecutiveEasyClears++;
      if (_consecutiveEasyClears>=3) {
        _difficultyBonus=Math.min(_difficultyBonus+2,15);
        _consecutiveEasyClears=0;
        _adaptiveDiffLabel=`⚡ Schwierigkeit +${_difficultyBonus}`;
      }
    } else {
      _consecutiveEasyClears=0;
      if(_difficultyBonus>0) _difficultyBonus=Math.max(0,_difficultyBonus-1);
      _adaptiveDiffLabel=_difficultyBonus>0?`⚡ +${_difficultyBonus}`:'';
    }
  }

  function init(canvas) {
    _canvas = canvas;
    _ctx    = canvas.getContext('2d');
    _resizeCanvas();
    window.addEventListener('resize', _resizeCanvas);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', _resizeCanvas);
    }
    Input.onMove((nx,ny)=>{ _launcher.x=nx*_canvas.width; _launcher.y=ny*_canvas.height; _launcher.visible=true; });
    Input.onTap(_handleTap);
    _totalStars    = Storage.get(Storage.KEYS.TOTAL_STARS) || 0;
    _currentStreak = Storage.getStreak();
    _tutorialDone  = !!Storage.get('br_tutorial_done');
    _refreshUpgrades();
    requestAnimationFrame(_loop);
  }

  function _resizeCanvas() {
    const vv = window.visualViewport;
    const w0 = vv ? vv.width  : document.documentElement.clientWidth;
    const h0 = vv ? vv.height : document.documentElement.clientHeight;

    const r = 16 / 9;
    let w, h;
    if (w0 / h0 > r) { h = h0; w = h * r; }
    else              { w = w0; h = w / r; }

    _canvas.width  = Math.floor(w);
    _canvas.height = Math.floor(h);
    _canvas.style.width  = Math.floor(w) + 'px';
    _canvas.style.height = Math.floor(h) + 'px';

    // Max 1.0: Desktop nie hochskalieren, nur Mobile runterskalieren
    _scale = Utils.clamp(_canvas.width / 836, 0.3, 1.0);

    if (_state === STATE.IDLE && _canvas.width > 300) _spawnBoard();
  }

  function _setState(s) {
    if (s === STATE.IDLE) _autoNextTimer = -1;
    _state = s;
    switch(s){
      case STATE.IDLE:   SDK.gameplayStop(); _spawnBoard(); break;
      case STATE.RESULT: SDK.gameplayStop(); _saveResult(); if(_boardIndex>0&&_boardIndex%3===0) SDK.commercialBreak(()=>{}); break;
      case STATE.SHOP:   SDK.gameplayStop(); break;
    }
  }

  function _spawnBoard(daily=false, weekly=false) {
    _isDailyBoard=daily; _isWeeklyBoard=weekly;
    _weeklyRule=weekly?_getWeeklyChallenge():null;
    _tapsUsed=0; _tapsResults=[]; _totalScore=0;
    _retryUsed=false; _overdrivePending=false; _lastMultiplier=1;
    _slowMotionUsed=false; _slowMotionActive=false;
    _refreshUpgrades();
    if(_weeklyRule?.maxTapsOverride) _cfg.maxTaps=_weeklyRule.maxTapsOverride;
    _missions=_generateMissions(_boardIndex, _weeklyRule?.missionOverride||null);

    _isTutorialBoard = (_boardIndex === 0 && !_tutorialDone && !daily && !weekly);
    if (_isTutorialBoard) {
      _bubbles = Board.generateTutorial(_canvas.width, _canvas.height, _cfg);
      return;
    }

    let seed;
    if(daily) seed=Utils.getDailySeed();
    else if(weekly) seed=_weeklyRule.seed;
    else seed=Utils.hashString('board:'+Date.now());
    _currentSeed=seed;
    const eff=_boardIndex+_difficultyBonus;
    _bubbles=Board.generate(seed, eff, _canvas.width, _canvas.height, _cfg);
  }

  function _retryBoard() {
    _tapsUsed=0; _tapsResults=[]; _totalScore=0;
    _overdrivePending=false; _lastMultiplier=1;
    _slowMotionUsed=false; _slowMotionActive=false;
    _missions=_generateMissions(_boardIndex, _weeklyRule?.missionOverride||null);
    _refreshUpgrades();
    const eff=_boardIndex+_difficultyBonus;
    _bubbles=Board.generate(_currentSeed, eff, _canvas.width, _canvas.height, _cfg);
    SDK.gameplayStart(); _state=STATE.PLAYING;
  }

  function _buyUpgrade(id) {
    const def=Upgrades.CATALOG.find(u=>u.id===id);
    if(!def) return;
    if(Upgrades.buy(id,_totalStars)) {
      _totalStars-=def.costPerLevel;
      Storage.set(Storage.KEYS.TOTAL_STARS,_totalStars);
      _refreshUpgrades();
    }
  }

  function _startExplosion() {
    // Launcher-Radius mit _scale — max 1.0, nie größer als Original
    let launchR = (_cfg.launcherRadius || BASE_LAUNCHER_RADIUS) * _scale;
    if(_cfg.overdriveEnabled&&_overdrivePending) {
      launchR=Math.round(launchR*1.5); _overdrivePending=false;
      if(typeof Renderer!=='undefined'){Renderer.triggerFlash(.25);Renderer.triggerShake(6,10);}
    }
    let startMultiplier=1;
    if(_tapsUsed>1) {
      if(_hasUnlock(_prestigeLevel,'resonance')) startMultiplier=_lastMultiplier;
      else if(_cfg.comboKeeperEnabled) startMultiplier=Math.max(1,Math.floor(_lastMultiplier/2));
    }
    _precisionHit=false;
    if(_cfg.precisionBonus>0) {
      _precisionHit=_bubbles.some(b=>{
        if(b.state!==BubbleState.IDLE||b.locked) return false;
        return Utils.distance(_launcher.x,_launcher.y,b.x,b.y)<=launchR+b.radius&&b.type.name==='MEGA';
      });
    }
    Explosion.startFromPosition(_launcher.x,_launcher.y,launchR,_bubbles,{
      chainDivisor:     _cfg.chainDivisor,
      infernoStep:      _cfg.chainInfernoStep,
      highRollerFactor: _cfg.highRollerFactor,
      startMultiplier,
    });
  }

  function _activateSlowMotion() {
    if(!_slowMotionAvailable||_slowMotionUsed) return;
    _slowMotionUsed=true; _slowMotionActive=true;
    if(typeof Renderer!=='undefined') Renderer.triggerFlash(.08);
  }

  function _handleTap(nx, ny) {
    if(SDK.isInAd()) return;
    const cx=nx*_canvas.width, cy=ny*_canvas.height;

    if(_state===STATE.SHOP) {
      const hit=Renderer.getHitButton(cx,cy);
      if(hit==='shop_back')        {_boardIndex++;_setState(STATE.IDLE);}
      else if(hit==='prestige')     {_doPrestige();}
      else if(hit==='hardcore_toggle' && _prestigeLevel>=9) {_hardcoreMode=!_hardcoreMode; _refreshUpgrades();}
      else if(hit?.startsWith('buy_')) _buyUpgrade(hit.replace('buy_',''));
      return;
    }
    if(_state===STATE.IDLE) {SDK.gameplayStart();_state=STATE.PLAYING;return;}
    if(_state===STATE.PLAYING) {
      const hit=Renderer.getHitButton(cx,cy);
      if(hit==='slow_motion') {_activateSlowMotion();return;}
      if(_tapsUsed>=_cfg.maxTaps) return;
      _tapsUsed++; _state=STATE.EXPLODING; _startExplosion(); return;
    }
    if(_state===STATE.EXPLODING) {
      const hit=Renderer.getHitButton(cx,cy);
      if(hit==='slow_motion') {_activateSlowMotion();return;}
    }
    if(_state===STATE.RESULT) {
      const hit=Renderer.getHitButton(cx,cy);
      if(_isTutorialBoard) {
        _autoNextTimer = -1; _boardIndex++; _setState(STATE.IDLE); return;
      }
      if(hit==='retry'&&!_retryUsed){_retryUsed=true;SDK.rewardedBreak(()=>{_retryBoard();});return;}
      if(hit==='daily'&&!Storage.hasDailyPlayedToday()){_boardIndex++;_spawnBoard(true);_state=STATE.IDLE;return;}
      if(hit==='weekly'&&!Storage.hasWeeklyPlayedThisWeek()){_spawnBoard(false,true);_state=STATE.IDLE;return;}
      if(hit==='shop'){_setState(STATE.SHOP);return;}
      _boardIndex++;_setState(STATE.IDLE);
    }
  }

  function _onChainComplete() {
    _slowMotionActive=false;
    let score=Explosion.getScore();
    const chainLen=Explosion.getChainLength(), mult=Explosion.getMultiplier(), mega=Explosion.hitMega();
    if(_precisionHit&&_cfg.precisionBonus>0){score=Math.round(score*(1+_cfg.precisionBonus));_precisionHit=false;if(typeof Renderer!=='undefined')Renderer.triggerFlash(.2);}
    const scoreFactor=(_hardcoreMode&&_prestigeLevel>=9)?5:1;
    score=Math.round(score*_prestigeMultiplier*scoreFactor);
    const result={score,chainLength:chainLen,multiplier:mult,hitMega:mega};
    _tapsResults.push(result); _totalScore+=score; _lastResult=result; _lastMultiplier=mult;
    if(_cfg.overdriveEnabled&&chainLen>=10) _overdrivePending=true;
    const stats=_getBoardStats();
    _missions.forEach(m=>{m.completed=m.check(stats);});
    const allDone=_missions.every(m=>m.completed);
    const tapsLeft=_cfg.maxTaps-_tapsUsed;
    const idleBubs=_bubbles.filter(b=>b.state===BubbleState.IDLE&&!b.locked);
    if(allDone||tapsLeft<=0||idleBubs.length===0) _setState(STATE.RESULT);
    else _state=STATE.PLAYING;
  }

  function _saveResult() {
    if(!_tapsResults.length) return;
    const stars=_checkMissions(); _totalStars+=stars;
    Storage.set(Storage.KEYS.TOTAL_STARS,_totalStars);
    const hs=Storage.get(Storage.KEYS.HIGH_SCORE)||0;
    if(_totalScore>hs) Storage.set(Storage.KEYS.HIGH_SCORE,_totalScore);
    const bc2=Math.max(0,..._tapsResults.map(r=>r.chainLength));
    const bc=Storage.get(Storage.KEYS.BEST_CHAIN)||0;
    if(bc2>bc) Storage.set(Storage.KEYS.BEST_CHAIN,bc2);
    if(_isDailyBoard){
      _currentStreak=Storage.getAndUpdateStreak();
      Storage.markDailyPlayedToday(_totalScore);
      if(_currentStreak>0&&_currentStreak%7===0){
        _totalStars+=5;Storage.set(Storage.KEYS.TOTAL_STARS,_totalStars);
        _pendingMilestone={label:'🔥 7-Tage Streak!',stars:5,desc:'Täglich spielen zahlt sich aus'};_milestoneTimer=4000;
      }
    }
    if(_isWeeklyBoard) Storage.markWeeklyPlayedThisWeek(_totalScore);
    _updateAdaptiveDifficulty();
    _checkMilestones(_totalScore);
    if (_isTutorialBoard) {
      Storage.set('br_tutorial_done', true);
      _tutorialDone  = true;
      _autoNextTimer = _AUTO_NEXT_DURATION;
    }
  }

  function _loop(timestamp) {
    const rawDt=Math.min(timestamp-_lastTime,50);
    _lastTime=timestamp;
    const dt=(_slowMotionActive&&_state===STATE.EXPLODING)?rawDt*.3:rawDt;

    if(_state===STATE.EXPLODING) {
      Explosion.update(dt);
      Particles.update(dt);
      if(!Explosion.isActive()) _onChainComplete();
    }

    if(_milestoneTimer>0) _milestoneTimer-=rawDt;
    if(_milestoneTimer<=0&&_milestoneTimer>-100){_pendingMilestone=null;_milestoneTimer=-200;}
    if(_prestigeUnlockTimer>0) _prestigeUnlockTimer-=rawDt;
    if(_prestigeUnlockTimer<=0&&_prestigeUnlockTimer>-100){_pendingPrestigeUnlock=null;_prestigeUnlockTimer=-200;}

    if (_autoNextTimer > 0 && _state === STATE.RESULT) {
      _autoNextTimer -= rawDt;
      if (_autoNextTimer <= 0) {
        _autoNextTimer = -1; _boardIndex++; _setState(STATE.IDLE);
      }
    }

    const weekly=_getWeeklyChallenge();
    const activeUnlocks=_getPrestigeUnlock(_prestigeLevel);

    if(typeof Renderer!=='undefined') {
      Renderer.draw(_ctx,_canvas,_state,_bubbles,_lastResult,{
        totalScore:           _totalScore,
        chainLength:          Explosion.getChainLength(),
        multiplier:           Explosion.getMultiplier(),
        level:                _boardIndex+1,
        boardIndex:           _boardIndex,
        isDailyBoard:         _isDailyBoard,
        isWeeklyBoard:        _isWeeklyBoard,
        weeklyLabel:          weekly.label,
        weeklyIcon:           weekly.icon,
        weeklyPlayedThisWeek: Storage.hasWeeklyPlayedThisWeek(),
        tapsUsed:             _tapsUsed,
        tapsMax:              _cfg.maxTaps||BASE_TAPS,
        tapsResults:          _tapsResults,
        missions:             _missions,
        totalStars:           _totalStars,
        launcher:             _launcher,
        launcherRadius:       (_cfg.launcherRadius||BASE_LAUNCHER_RADIUS) * _scale,
        retryUsed:            _retryUsed,
        dailyPlayedToday:     Storage.hasDailyPlayedToday(),
        upgradeStatus:        Upgrades.getStatus(_totalStars),
        overdrivePending:     _overdrivePending,
        trailEnabled:         _cfg.trailEnabled,
        prestigeLevel:        _prestigeLevel,
        prestigeAvailable:    _isPrestigeAvailable(),
        prestigeUnlocks:      PRESTIGE_UNLOCKS,
        activeUnlocks,
        activeTheme:          _getActiveTheme(_prestigeLevel),
        hardcoreMode:         _hardcoreMode,
        hardcoreAvailable:    _prestigeLevel>=9,
        slowMotionAvailable:  _slowMotionAvailable,
        slowMotionUsed:       _slowMotionUsed,
        slowMotionActive:     _slowMotionActive,
        currentStreak:        _currentStreak,
        difficultyBonus:      _difficultyBonus,
        adaptiveDiffLabel:    _adaptiveDiffLabel,
        pendingMilestone:     _milestoneTimer>0?_pendingMilestone:null,
        pendingPrestigeUnlock: _prestigeUnlockTimer>0?_pendingPrestigeUnlock:null,
        totalScoreAllTime:    Storage.getTotalScore(),
        milestones:           MILESTONES,
        milestonesReached:    Storage.getMilestonesReached(),
        isTutorialBoard:      _isTutorialBoard,
        autoNextProgress:     _autoNextTimer < 0
                                ? -1
                                : 1 - (_autoNextTimer / _AUTO_NEXT_DURATION),
      });
    }
    requestAnimationFrame(_loop);
  }

  function getState()   { return _state; }
  function getBubbles() { return _bubbles; }
  function start()      { _setState(STATE.IDLE); }

  return { init, start, getState, getBubbles, STATE };
})();