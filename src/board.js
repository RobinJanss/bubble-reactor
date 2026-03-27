// board.js — Board-Generierung mit Seed

const Board = (() => {

  function getBubbleCount(boardIndex) {
    return Utils.clamp(28 + boardIndex * 3, 28, 45);
  }

  function tryPlace(rng, existing, canvasW, canvasH, radius) {
    const padding = radius + 6;
    const maxAttempts = 120;

    for (let i = 0; i < maxAttempts; i++) {
      const x = padding + rng() * (canvasW - padding * 2);
      const y = padding + canvasH * 0.06 + rng() * (canvasH * 0.86 - padding);

      // Enger gepackt — nur 2px Abstand zwischen Bubbles
      const overlaps = existing.some(b => {
        return Utils.distance(x, y, b.x, b.y) < b.radius + radius + 2;
      });

      if (!overlaps) return { x, y };
    }
    return null;
  }

  function generate(seed, boardIndex, canvasW, canvasH) {
    const rng = Utils.createRNG(seed + boardIndex * 1000);
    const bubbles = [];
    const count = getBubbleCount(boardIndex);

    for (let i = 0; i < count; i++) {
      const type = Bubble.randomType(rng);
      const pos = tryPlace(rng, bubbles, canvasW, canvasH, type.baseRadius);
      if (pos) {
        bubbles.push(new Bubble(pos.x, pos.y, type));
      }
    }

    return bubbles;
  }

  function generateDaily(canvasW, canvasH) {
    return generate(Utils.getDailySeed(), 0, canvasW, canvasH);
  }

  return { generate, generateDaily };
})();