// board.js — Board-Generierung mit Seed
// Platziert Bubbles ohne Überlappung, reproduzierbar per Seed.

const Board = (() => {

  // Anzahl Bubbles je nach Board-Nummer (steigt leicht an)
  function getBubbleCount(boardIndex) {
    return Utils.clamp(12 + boardIndex * 2, 12, 28);
  }

  // Versucht eine Bubble ohne Überlappung zu platzieren
  function tryPlace(rng, existing, canvasW, canvasH, radius) {
    const padding = radius + 10;
    const maxAttempts = 50;

    for (let i = 0; i < maxAttempts; i++) {
      const x = padding + rng() * (canvasW - padding * 2);
      const y = padding + canvasH * 0.12 + rng() * (canvasH * 0.78 - padding);

      // Überlappungscheck
      const overlaps = existing.some(b => {
        return Utils.distance(x, y, b.x, b.y) < b.radius + radius + 8;
      });

      if (!overlaps) return { x, y };
    }
    return null; // Kein Platz gefunden
  }

  // Board generieren
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

  // Daily Board — fixer Seed für heute
  function generateDaily(canvasW, canvasH) {
    return generate(Utils.getDailySeed(), 0, canvasW, canvasH);
  }

  return { generate, generateDaily };
})();