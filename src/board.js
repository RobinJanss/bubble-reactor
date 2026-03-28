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

  function generate(seed, boardIndex, canvasW, canvasH, cfg = {}) {
    // ── Skalierung: nur nach UNTEN (max 1.0) ─────────────────────────────
    // Desktop (>= 836px): scale = 1.0 → originale Werte, unverändert
    // Mobile (< 836px):   scale < 1.0 → Bubbles und Explosionen proportional kleiner
    // Verhindert, dass Explosion-Radien auf großen Screens zu groß werden.
    const scale = Utils.clamp(canvasW / 836, 0.3, 1.0);

    const rng          = Utils.createRNG(seed + boardIndex * 1000);
    const bubbles      = [];
    const count        = _getBubbleCount(boardIndex);
    const minGap       = Math.round(_getMinGap(boardIndex) * scale);
    const reactionBoost  = cfg.reactionBoost     || 0;
    const megaBoost      = cfg.megaRadiusBoost   || 0;
    const magnetBoost    = cfg.bubbleMagnetBoost || 0;
    const prestigeLevel  = cfg.prestigeLevel     || 0;

    for (let i = 0; i < count; i++) {
      const type         = Bubble.randomType(rng, boardIndex, prestigeLevel);
      const scaledRadius = Math.round(type.baseRadius * scale);
      const pos          = tryPlace(rng, bubbles, canvasW, canvasH, scaledRadius, minGap);
      if (!pos) continue;

      const b = new Bubble(pos.x, pos.y, type);
      b.radius          = scaledRadius;
      b.explosionRadius = Math.round(scaledRadius * type.explosionMult);

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

  // ── Tutorial Board ──────────────────────────────────────────────────────
  function generateTutorial(canvasW, canvasH, cfg = {}) {
    const scale = Utils.clamp(canvasW / 836, 0.3, 1.0);
    const SEED  = 0x54757421;
    const rng   = Utils.createRNG(SEED);

    const DIST = [
      { type: BubbleType.SMALL,  weight: 25 },
      { type: BubbleType.MEDIUM, weight: 45 },
      { type: BubbleType.LARGE,  weight: 25 },
      { type: BubbleType.MICRO,  weight: 5  },
    ];
    const totalW = DIST.reduce((s, e) => s + e.weight, 0);

    function pickType() {
      let r = rng() * totalW;
      for (const e of DIST) { r -= e.weight; if (r <= 0) return e.type; }
      return BubbleType.MEDIUM;
    }

    const areaW  = canvasW * 0.58;
    const areaH  = canvasH * 0.62;
    const areaX  = (canvasW - areaW) / 2;
    const areaY  = (canvasH - areaH) / 2 + canvasH * 0.04;
    const minGap = Math.round(1 * scale);
    const count  = 26;
    const bubbles = [];
    const reactionBoost = cfg.reactionBoost || 0;

    for (let i = 0; i < count; i++) {
      const type         = pickType();
      const scaledRadius = Math.round(type.baseRadius * scale);
      const padding      = scaledRadius + 3;
      let placed         = null;

      for (let attempt = 0; attempt < 250; attempt++) {
        const x = areaX + padding + rng() * (areaW - padding * 2);
        const y = areaY + padding + rng() * (areaH - padding * 2);
        if (!bubbles.some(b => Utils.distance(x, y, b.x, b.y) < b.radius + scaledRadius + minGap)) {
          placed = { x, y };
          break;
        }
      }
      if (!placed) continue;

      const b = new Bubble(placed.x, placed.y, type);
      b.radius          = scaledRadius;
      b.explosionRadius = Math.round(scaledRadius * type.explosionMult);
      if (reactionBoost > 0) {
        b.explosionRadius = Math.round(b.explosionRadius * (1 + reactionBoost));
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

  return { generate, generateTutorial, generateDaily, generateWeekly };
})();