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
    const padding     = radius + 6;
    const maxAttempts = 150;
    for (let i = 0; i < maxAttempts; i++) {
      const x = padding + rng() * (canvasW - padding * 2);
      const y = padding + canvasH * 0.06 + rng() * (canvasH * 0.86 - padding);
      const overlaps = existing.some(b =>
        Utils.distance(x, y, b.x, b.y) < b.radius + radius + minGap
      );
      if (!overlaps) return { x, y };
    }
    return null;
  }

  // megaRadiusBoost: Upgrade-Effekt (z.B. 0.25 = +25% Explosionsradius für MEGA)
  function generate(seed, boardIndex, canvasW, canvasH, megaRadiusBoost = 0) {
    const rng    = Utils.createRNG(seed + boardIndex * 1000);
    const bubbles = [];
    const count  = _getBubbleCount(boardIndex);
    const minGap = _getMinGap(boardIndex);

    for (let i = 0; i < count; i++) {
      const type = Bubble.randomType(rng, boardIndex);
      const pos  = tryPlace(rng, bubbles, canvasW, canvasH, type.baseRadius, minGap);
      if (pos) {
        const b = new Bubble(pos.x, pos.y, type);
        // Mega Magnet Upgrade — MEGA Bubbles bekommen größeren Explosionsradius
        if (megaRadiusBoost > 0 && type.name === 'MEGA') {
          b.explosionRadius = Math.round(b.explosionRadius * (1 + megaRadiusBoost));
        }
        bubbles.push(b);
      }
    }
    return bubbles;
  }

  function generateDaily(canvasW, canvasH) {
    return generate(Utils.getDailySeed(), 0, canvasW, canvasH, 0);
  }

  return { generate, generateDaily };
})();