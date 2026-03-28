// board.js — Board-Generierung mit Seed + Schwierigkeits-Ramp

const Board = (() => {

  function _getBubbleCount(boardIndex) {
    return Utils.clamp(28 + boardIndex * 2, 28, 52);
  }

  function _getMinGap(boardIndex) {
    if (boardIndex >= 20) return 1;
    if (boardIndex >= 10) return 2;
    return 4;
  }

  function tryPlace(rng, existing, canvasW, canvasH, radius, minGap) {
    const padding = radius + 6, maxAttempts = 150;
    for (let i = 0; i < maxAttempts; i++) {
      const x = padding + rng() * (canvasW - padding * 2);
      const y = padding + canvasH * 0.06 + rng() * (canvasH * 0.86 - padding);
      if (!existing.some(b => Utils.distance(x, y, b.x, b.y) < b.radius + radius + minGap)) {
        return { x, y };
      }
    }
    return null;
  }

  // cfg = Upgrade-Konfiguration aus Upgrades.getGameConfig()
  function generate(seed, boardIndex, canvasW, canvasH, cfg = {}) {
    const rng          = Utils.createRNG(seed + boardIndex * 1000);
    const bubbles      = [];
    const count        = _getBubbleCount(boardIndex);
    const minGap       = _getMinGap(boardIndex);
    const reactionBoost = cfg.reactionBoost      || 0;   // Kettenreaktion+
    const megaBoost     = cfg.megaRadiusBoost    || 0;   // Mega Magnet
    const magnetBoost   = cfg.bubbleMagnetBoost  || 0;   // Bubble Magnet

    for (let i = 0; i < count; i++) {
      const type = Bubble.randomType(rng, boardIndex);
      const pos  = tryPlace(rng, bubbles, canvasW, canvasH, type.baseRadius, minGap);
      if (!pos) continue;

      const b = new Bubble(pos.x, pos.y, type);

      // ── Upgrade-Effekte auf Explosionsradius ──────────────────────────

      // Kettenreaktion+: alle Bubbles bekommen Boost
      if (reactionBoost > 0) {
        b.explosionRadius = Math.round(b.explosionRadius * (1 + reactionBoost));
      }

      // Mega Magnet: MEGA Bubbles extra Boost
      if (megaBoost > 0 && type.name === 'MEGA') {
        b.explosionRadius = Math.round(b.explosionRadius * (1 + megaBoost));
      }

      // Bubble Magnet: SMALL und MICRO bekommen Boost
      if (magnetBoost > 0 && (type.name === 'SMALL' || type.name === 'MICRO')) {
        b.explosionRadius = Math.round(b.explosionRadius * (1 + magnetBoost));
      }

      bubbles.push(b);
    }

    return bubbles;
  }

  function generateDaily(canvasW, canvasH) {
    return generate(Utils.getDailySeed(), 0, canvasW, canvasH, {});
  }

  return { generate, generateDaily };
})();