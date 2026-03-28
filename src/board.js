// board.js — Board-Generierung mit Seed + Schwierigkeits-Ramp

const Board = (() => {

  function _getBubbleCount(boardIndex) {
    return Utils.clamp(28 + boardIndex * 2, 28, 58);
  }

  function _getMinGap(boardIndex) {
    if (boardIndex >= 20) return 1;
    if (boardIndex >= 10) return 2;
    return 4;
  }

  function tryPlace(rng, existing, canvasW, canvasH, radius, minGap) {
    const padding = radius + 6;
    for (let i = 0; i < 150; i++) {
      const x = padding + rng() * (canvasW - padding * 2);
      const y = padding + canvasH * 0.06 + rng() * (canvasH * 0.86 - padding);
      if (!existing.some(b => Utils.distance(x, y, b.x, b.y) < b.radius + radius + minGap))
        return { x, y };
    }
    return null;
  }

  // cfg enthält Upgrade-Werte + prestigeLevel
  function generate(seed, boardIndex, canvasW, canvasH, cfg = {}) {
    const rng            = Utils.createRNG(seed + boardIndex * 1000);
    const bubbles        = [];
    const count          = _getBubbleCount(boardIndex);
    const minGap         = _getMinGap(boardIndex);
    const reactionBoost  = cfg.reactionBoost     || 0;
    const megaBoost      = cfg.megaRadiusBoost   || 0;
    const magnetBoost    = cfg.bubbleMagnetBoost || 0;
    const prestigeLevel  = cfg.prestigeLevel     || 0;

    for (let i = 0; i < count; i++) {
      const type = Bubble.randomType(rng, boardIndex, prestigeLevel);
      const pos  = tryPlace(rng, bubbles, canvasW, canvasH, type.baseRadius, minGap);
      if (!pos) continue;

      const b = new Bubble(pos.x, pos.y, type);

      // Upgrade-Boni auf Explosionsradius
      if (reactionBoost > 0 && !type.special) {
        b.explosionRadius = Math.round(b.explosionRadius * (1 + reactionBoost));
      }
      if (megaBoost > 0 && type.name === 'MEGA') {
        b.explosionRadius = Math.round(b.explosionRadius * (1 + megaBoost));
      }
      if (magnetBoost > 0 && (type.name === 'SMALL' || type.name === 'MICRO')) {
        b.explosionRadius = Math.round(b.explosionRadius * (1 + magnetBoost));
      }

      bubbles.push(b);
    }
    return bubbles;
  }

  function generateDaily(canvasW, canvasH, cfg = {}) {
    return generate(Utils.getDailySeed(), 0, canvasW, canvasH, cfg);
  }

  function generateWeekly(canvasW, canvasH, weekSeed, cfg = {}) {
    return generate(weekSeed, 5, canvasW, canvasH, cfg);
  }

  return { generate, generateDaily, generateWeekly };
})();