// explosion.js — Chain-Reaktions-Logik

const Explosion = (() => {

  let _queue        = [];
  let _timer        = 0;
  let _active       = false;
  let _score        = 0;
  let _chainLength  = 0;
  let _multiplier   = 1;
  let _hitMega      = false;
  let _chainDivisor = 2;

  function _triggerFeedback(typeName) {
    if (typeof Renderer === 'undefined') return;
    switch (typeName) {
      case 'MEGA':
        Renderer.triggerShake(11, 24);
        Renderer.triggerFlash(0.55);
        if (typeof Audio !== 'undefined') Audio.playBoom();
        break;
      case 'LARGE':
        Renderer.triggerShake(5, 13);
        Renderer.triggerFlash(0.18);
        break;
      case 'MEDIUM':
        Renderer.triggerShake(2, 7);
        break;
    }
  }

  function startFromPosition(x, y, launchRadius, allBubbles, chainDivisor = 2) {
    _queue        = [];
    _timer        = 0;
    _active       = true;
    _score        = 0;
    _chainLength  = 0;
    _multiplier   = 1;
    _hitMega      = false;
    _chainDivisor = chainDivisor;

    allBubbles.forEach(bubble => {
      if (bubble.state !== BubbleState.IDLE) return;
      if (Utils.distance(x, y, bubble.x, bubble.y) <= launchRadius + bubble.radius) {
        _enqueue(bubble, 0);
      }
    });
    _processChain(allBubbles);
  }

  function start(tappedBubble, allBubbles, chainDivisor = 2) {
    _queue        = [];
    _timer        = 0;
    _active       = true;
    _score        = 0;
    _chainLength  = 0;
    _multiplier   = 1;
    _hitMega      = false;
    _chainDivisor = chainDivisor;
    _enqueue(tappedBubble, 0);
    _processChain(allBubbles);
  }

  function _enqueue(bubble, delay) {
    if (bubble.state !== BubbleState.IDLE) return;
    bubble.state = BubbleState.EXPLODING;
    _queue.push({ bubble, delay, triggered: false });
  }

  function _processChain(allBubbles) {
    const toProcess = [..._queue.map(q => q.bubble)];
    const processed = new Set(toProcess);

    while (toProcess.length > 0) {
      const current      = toProcess.shift();
      const currentEntry = _queue.find(q => q.bubble === current);
      const currentDelay = currentEntry ? currentEntry.delay : 0;

      allBubbles.forEach(other => {
        if (other.state === BubbleState.IDLE && current.isInExplosionRadius(other)) {
          if (!processed.has(other)) {
            processed.add(other);
            _enqueue(other, currentDelay + 60 + Math.floor(Math.random() * 60));
            toProcess.push(other);
          }
        }
      });
    }
  }

  function update(dt) {
    if (!_active) return;
    _timer += dt;

    _queue.forEach(entry => {
      if (entry.triggered) return;
      if (_timer >= entry.delay) {
        entry.triggered = true;
        entry.bubble.explosionProgress = 0;

        _chainLength++;
        _multiplier = Math.floor(1 + _chainLength / _chainDivisor);
        _score     += entry.bubble.type.points * _multiplier;

        if (entry.bubble.type.name === 'MEGA') _hitMega = true;

        if (typeof Particles !== 'undefined')
          Particles.emit(entry.bubble.x, entry.bubble.y, entry.bubble.type.color, 14);
        if (typeof Audio !== 'undefined')
          Audio.playPop(_chainLength);

        _triggerFeedback(entry.bubble.type.name);
      }
    });

    _queue.forEach(entry => {
      if (!entry.triggered || entry.bubble.state === BubbleState.DEAD) return;
      entry.bubble.explosionProgress = Utils.clamp(
        entry.bubble.explosionProgress + dt / 280, 0, 1
      );
      if (entry.bubble.explosionProgress >= 1) entry.bubble.state = BubbleState.DEAD;
    });

    if (_queue.every(e => e.triggered) && _queue.every(e => e.bubble.state === BubbleState.DEAD) && _queue.length > 0) {
      _active = false;
    }
  }

  function isActive()       { return _active; }
  function getScore()       { return _score; }
  function getChainLength() { return _chainLength; }
  function getMultiplier()  { return _multiplier; }
  function hitMega()        { return _hitMega; }

  return { start, startFromPosition, update, isActive, getScore, getChainLength, getMultiplier, hitMega };
})();