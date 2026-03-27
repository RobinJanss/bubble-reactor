// explosion.js — Chain-Reaktions-Logik
// Das Herzstück: Bubbles explodieren nacheinander mit Delay.

const Explosion = (() => {

  // Aktive Explosion Queue
  let _queue = [];        // { bubble, delay } — noch ausstehend
  let _timer = 0;         // Zeitakkumulator
  let _active = false;
  let _score = 0;
  let _chainLength = 0;
  let _multiplier = 1;
  let _onComplete = null; // Callback wenn Chain fertig

  // Startet eine neue Chain ab einer getippten Bubble
  function start(tappedBubble, allBubbles, onComplete) {
    _queue = [];
    _timer = 0;
    _active = true;
    _score = 0;
    _chainLength = 0;
    _multiplier = 1;
    _onComplete = onComplete;

    // Erste Bubble sofort in die Queue
    _enqueue(tappedBubble, 0);
    _processChain(allBubbles);
  }

  // Fügt eine Bubble mit Delay in die Queue ein
  function _enqueue(bubble, delay) {
    if (bubble.state !== BubbleState.IDLE) return;
    bubble.state = BubbleState.EXPLODING;
    _queue.push({ bubble, delay, triggered: false });
  }

  // Berechnet welche Bubbles durch eine Explosion getroffen werden
  function _processChain(allBubbles) {
    // BFS — alle erreichbaren Bubbles in Reihenfolge einreihen
    const processed = new Set();
    const toProcess = _queue.map(q => q.bubble);

    while (toProcess.length > 0) {
      const current = toProcess.shift();
      if (processed.has(current)) continue;
      processed.add(current);

      // Delay basiert auf Position in der Chain
      const currentDelay = _queue.find(q => q.bubble === current)?.delay ?? 0;

      allBubbles.forEach(other => {
        if (other.state === BubbleState.IDLE && current.isInExplosionRadius(other)) {
          const newDelay = currentDelay + Utils.randInt(
            { call: Math.random }, 80, 150
          );
          _enqueue(other, currentDelay + 100);
          toProcess.push(other);
        }
      });
    }
  }

  // Update — wird vom Game Loop aufgerufen (dt in ms)
  function update(dt) {
    if (!_active) return;

    _timer += dt;

    let allDone = true;

    _queue.forEach(entry => {
      if (entry.triggered) return;

      if (_timer >= entry.delay) {
        entry.triggered = true;
        entry.bubble.state = BubbleState.EXPLODING;
        entry.bubble.explosionProgress = 0;

        // Score berechnen
        _chainLength++;
        _multiplier = Math.floor(1 + _chainLength / 3);
        _score += entry.bubble.type.points * _multiplier;

        // Partikel & Audio triggern
        if (typeof Particles !== 'undefined') {
          Particles.emit(entry.bubble.x, entry.bubble.y, entry.bubble.type.color, 12);
        }
        if (typeof Audio !== 'undefined') {
          Audio.playPop(_chainLength);
        }
      }

      if (!entry.triggered) allDone = false;
    });

    // Explodierte Bubbles animieren
    _queue.forEach(entry => {
      if (!entry.triggered) return;
      entry.bubble.explosionProgress = Utils.clamp(
        entry.bubble.explosionProgress + dt / 300, 0, 1
      );
      if (entry.bubble.explosionProgress >= 1) {
        entry.bubble.state = BubbleState.DEAD;
        entry.bubble.opacity = 0;
      }
    });

    // Chain fertig?
    const allTriggered = _queue.every(e => e.triggered);
    const allDead = _queue.every(e => e.bubble.state === BubbleState.DEAD);

    if (allTriggered && allDead) {
      _active = false;
      if (typeof _onComplete === 'function') {
        _onComplete({ score: _score, chainLength: _chainLength, multiplier: _multiplier });
      }
    }
  }

  function isActive() { return _active; }
  function getScore() { return _score; }
  function getChainLength() { return _chainLength; }
  function getMultiplier() { return _multiplier; }

  return { start, update, isActive, getScore, getChainLength, getMultiplier };
})();