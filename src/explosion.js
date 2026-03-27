// explosion.js — Chain-Reaktions-Logik
// Kann von einer Position ODER einer Bubble aus starten.

const Explosion = (() => {

  let _queue = [];
  let _timer = 0;
  let _active = false;
  let _score = 0;
  let _chainLength = 0;
  let _multiplier = 1;
  let _hitMega = false;

  // Start von einer virtuellen Position (Launcher-Bubble)
  function startFromPosition(x, y, launchRadius, allBubbles) {
    _queue = [];
    _timer = 0;
    _active = true;
    _score = 0;
    _chainLength = 0;
    _multiplier = 1;
    _hitMega = false;

    // Alle Bubbles im Launch-Radius direkt einreihen
    allBubbles.forEach(bubble => {
      if (bubble.state !== BubbleState.IDLE) return;
      const dist = Utils.distance(x, y, bubble.x, bubble.y);
      if (dist <= launchRadius + bubble.radius) {
        _enqueue(bubble, 0);
      }
    });

    // Chain von diesen Bubbles aus weiter ausbreiten
    _processChain(allBubbles);
  }

  // Start von einer existierenden Bubble
  function start(tappedBubble, allBubbles) {
    _queue = [];
    _timer = 0;
    _active = true;
    _score = 0;
    _chainLength = 0;
    _multiplier = 1;
    _hitMega = false;

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
      const current = toProcess.shift();
      const currentEntry = _queue.find(q => q.bubble === current);
      const currentDelay = currentEntry ? currentEntry.delay : 0;

      allBubbles.forEach(other => {
        if (other.state === BubbleState.IDLE && current.isInExplosionRadius(other)) {
          if (!processed.has(other)) {
            processed.add(other);
            const newDelay = currentDelay + 60 + Math.floor(Math.random() * 60);
            _enqueue(other, newDelay);
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
        // Einfachere Multiplikatoren — alle 2 statt alle 3
        _multiplier = Math.floor(1 + _chainLength / 2);
        _score += entry.bubble.type.points * _multiplier;

        if (entry.bubble.type.name === 'MEGA') _hitMega = true;

        if (typeof Particles !== 'undefined') {
          Particles.emit(entry.bubble.x, entry.bubble.y, entry.bubble.type.color, 14);
        }
        if (typeof Audio !== 'undefined') {
          Audio.playPop(_chainLength);
        }
      }
    });

    _queue.forEach(entry => {
      if (!entry.triggered || entry.bubble.state === BubbleState.DEAD) return;
      entry.bubble.explosionProgress = Utils.clamp(
        entry.bubble.explosionProgress + dt / 280, 0, 1
      );
      if (entry.bubble.explosionProgress >= 1) {
        entry.bubble.state = BubbleState.DEAD;
      }
    });

    const allTriggered = _queue.every(e => e.triggered);
    const allDead = _queue.every(e => e.bubble.state === BubbleState.DEAD);

    if (allTriggered && allDead && _queue.length > 0) {
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