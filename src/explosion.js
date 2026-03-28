// explosion.js — Chain-Reaktions-Logik mit Spezial-Bubble-Mechaniken

const Explosion = (() => {

  let _queue            = [];
  let _timer            = 0;
  let _active           = false;
  let _score            = 0;
  let _chainLength      = 0;
  let _multiplier       = 1;
  let _hitMega          = false;
  let _lockedUnlocked   = 0;   // Anzahl freigeschalteter Locked-Bubbles diese Explosion

  // Upgrade-Werte
  let _chainDivisor     = 2;
  let _infernoStep      = 0;
  let _highRollerFactor = 1.0;
  let _startMultiplier  = 1;

  function _triggerFeedback(typeName) {
    if (typeof Renderer === 'undefined') return;
    switch (typeName) {
      case 'MEGA':
        Renderer.triggerShake(11, 24); Renderer.triggerFlash(0.55);
        if (typeof Audio !== 'undefined') Audio.playBoom();
        break;
      case 'LARGE':   Renderer.triggerShake(5, 13);  Renderer.triggerFlash(0.18); break;
      case 'MEDIUM':  Renderer.triggerShake(2, 7);   break;
      case 'SHIELD':  Renderer.triggerShake(4, 10);  Renderer.triggerFlash(0.12); break;
      case 'PHANTOM': Renderer.triggerShake(7, 16);  Renderer.triggerFlash(0.30); break;
    }
  }

  function _resetState(opts = {}) {
    _queue            = [];
    _timer            = 0;
    _active           = true;
    _score            = 0;
    _chainLength      = 0;
    _hitMega          = false;
    _lockedUnlocked   = 0;
    _chainDivisor     = opts.chainDivisor      ?? 2;
    _infernoStep      = opts.infernoStep       ?? 0;
    _highRollerFactor = opts.highRollerFactor  ?? 1.0;
    _startMultiplier  = opts.startMultiplier   ?? 1;
    _multiplier       = _startMultiplier;
  }

  // ── Enqueue ────────────────────────────────────────────────────────────
  function _enqueue(bubble, delay) {
    if (bubble.state !== BubbleState.IDLE) return;
    bubble.state = BubbleState.EXPLODING;
    _queue.push({ bubble, delay, triggered: false });
  }

  // ── Chain-Propagation mit Spezial-Logik ───────────────────────────────
  function _processChain(allBubbles) {
    const toProcess = [..._queue.map(q => q.bubble)];
    const processed = new Set(toProcess);

    while (toProcess.length > 0) {
      const current      = toProcess.shift();
      const currentEntry = _queue.find(q => q.bubble === current);
      const currentDelay = currentEntry ? currentEntry.delay : 0;

      // GLASS: kein Explosionsradius → propagiert nicht (explosionRadius = 0 → isInExplosionRadius = false)
      // Trotzdem explizit überspringen für Klarheit
      if (current.type.name === 'GLASS') continue;

      allBubbles.forEach(other => {
        if (other.state !== BubbleState.IDLE) return;

        // PHANTOM: nicht durch andere Explosionen triggern — nur per Launcher-Direkttreffer
        if (other.type.name === 'PHANTOM') return;

        if (!current.isInExplosionRadius(other)) return;

        // LOCKED: freischalten aber NICHT in dieser Chain triggern
        if (other.locked) {
          other.locked         = false;
          other.explosionRadius = other.type.baseRadius * (other.type.unlockedMult || 3.6);
          _lockedUnlocked++;
          // Visuelles Feedback: kurzes Aufleuchten
          other.showHit = true;
          setTimeout(() => { if (other) other.showHit = false; }, 500);
          return;
        }

        // SHIELD: erster Treffer → beschädigen, kein Trigger
        if (other.type.name === 'SHIELD' && other.hitCount < 1) {
          other.hitCount = 1;
          other.showHit  = true;
          setTimeout(() => { if (other) other.showHit = false; }, 400);
          if (typeof Particles !== 'undefined') {
            Particles.emit(other.x, other.y, '#A78BFA', 8);
          }
          return;
        }

        // Normal: einreihen
        if (!processed.has(other)) {
          processed.add(other);
          _enqueue(other, currentDelay + 60 + Math.floor(Math.random() * 60));
          toProcess.push(other);
        }
      });
    }
  }

  // ── Start von Launcher-Position ────────────────────────────────────────
  function startFromPosition(x, y, launchRadius, allBubbles, opts = {}) {
    _resetState(opts);
    allBubbles.forEach(bubble => {
      if (bubble.state !== BubbleState.IDLE) return;
      if (bubble.locked) return;   // Gesperrte Bubbles nicht direkt triggern
      if (Utils.distance(x, y, bubble.x, bubble.y) <= launchRadius + bubble.radius) {
        _enqueue(bubble, 0);
      }
    });
    _processChain(allBubbles);
  }

  // ── Start von Bubble ───────────────────────────────────────────────────
  function start(tappedBubble, allBubbles, opts = {}) {
    _resetState(opts);
    _enqueue(tappedBubble, 0);
    _processChain(allBubbles);
  }

  // ── Update ─────────────────────────────────────────────────────────────
  function update(dt) {
    if (!_active) return;
    _timer += dt;

    _queue.forEach(entry => {
      if (entry.triggered || _timer < entry.delay) return;
      entry.triggered = true;
      entry.bubble.explosionProgress = 0;

      _chainLength++;
      _multiplier = Math.max(
        _startMultiplier,
        Math.floor(1 + _chainLength / _chainDivisor)
      );

      // ── Chain Inferno ────────────────────────────────────────────────
      const isInferno = _infernoStep > 0 && _chainLength > 0 && _chainLength % _infernoStep === 0;
      let scoreMult = _multiplier;
      if (isInferno) {
        scoreMult *= 2;
        if (typeof Renderer !== 'undefined') { Renderer.triggerShake(4, 8); Renderer.triggerFlash(0.12); }
        if (typeof Particles !== 'undefined') Particles.emit(entry.bubble.x, entry.bubble.y, '#FF6B35', 20);
      }

      // ── High Roller ──────────────────────────────────────────────────
      if (_highRollerFactor > 1.0 && _multiplier >= 5) scoreMult = Math.round(scoreMult * _highRollerFactor);

      _score += entry.bubble.type.points * scoreMult;

      if (entry.bubble.type.name === 'MEGA') _hitMega = true;

      if (typeof Particles !== 'undefined')
        Particles.emit(entry.bubble.x, entry.bubble.y, entry.bubble.type.color, 14);
      if (typeof Audio !== 'undefined')
        Audio.playPop(_chainLength);

      _triggerFeedback(entry.bubble.type.name);
    });

    _queue.forEach(entry => {
      if (!entry.triggered || entry.bubble.state === BubbleState.DEAD) return;
      entry.bubble.explosionProgress = Utils.clamp(entry.bubble.explosionProgress + dt / 280, 0, 1);
      if (entry.bubble.explosionProgress >= 1) entry.bubble.state = BubbleState.DEAD;
    });

    if (_queue.every(e => e.triggered) &&
        _queue.every(e => e.bubble.state === BubbleState.DEAD) &&
        _queue.length > 0) {
      _active = false;
    }
  }

  function isActive()           { return _active; }
  function getScore()           { return _score; }
  function getChainLength()     { return _chainLength; }
  function getMultiplier()      { return _multiplier; }
  function hitMega()            { return _hitMega; }
  function getLockedUnlocked()  { return _lockedUnlocked; }

  return { start, startFromPosition, update, isActive, getScore, getChainLength, getMultiplier, hitMega, getLockedUnlocked };
})();