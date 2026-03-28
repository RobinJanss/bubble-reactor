// bubble.js — Bubble Klasse + alle Typen

const BubbleType = {
  // ── Standard-Typen ──────────────────────────────────────────────────────
  MICRO:  { name: 'MICRO',  color: '#00C6FF', glowColor: '#0099CC', baseRadius: 18, explosionMult: 2.5, points: 10  },
  SMALL:  { name: 'SMALL',  color: '#39FF14', glowColor: '#22CC00', baseRadius: 24, explosionMult: 3.0, points: 25  },
  MEDIUM: { name: 'MEDIUM', color: '#FFE600', glowColor: '#CCA800', baseRadius: 30, explosionMult: 3.5, points: 50  },
  LARGE:  { name: 'LARGE',  color: '#FF8C00', glowColor: '#CC6600', baseRadius: 38, explosionMult: 4.0, points: 100 },
  MEGA:   { name: 'MEGA',   color: '#FF4757', glowColor: '#CC1122', baseRadius: 48, explosionMult: 5.0, points: 250 },

  // ── Spezial-Typen (ab Level 10) ─────────────────────────────────────────
  // 🛡️ SHIELD: braucht 2 Treffer. Erster Treffer → beschädigt, zweiter → explodiert.
  SHIELD: {
    name: 'SHIELD', color: '#A78BFA', glowColor: '#7C3AED',
    baseRadius: 34, explosionMult: 3.8, points: 120,
    special: 'shield',
  },
  // 💀 GLASS: Explodiert sofort wenn getroffen, ABER gibt keinen Explosionsradius weiter (Chain-Stopper).
  GLASS: {
    name: 'GLASS', color: '#BAE6FD', glowColor: '#7DD3FC',
    baseRadius: 22, explosionMult: 0.0, points: 15,
    special: 'glass',
  },
  // ⭕ PHANTOM: Hat vollen Radius, aber wird NICHT durch andere Explosionen getriggert.
  //    Muss direkt vom Launcher getroffen werden.
  PHANTOM: {
    name: 'PHANTOM', color: '#D1FAE5', glowColor: '#6EE7B7',
    baseRadius: 28, explosionMult: 3.5, points: 200,
    special: 'phantom',
  },
  // 🔒 LOCKED: Startet gesperrt (kein Radius). Wird durch benachbarte Explosion freigeschaltet.
  //    Erst im nächsten Tap triggern.
  LOCKED: {
    name: 'LOCKED', color: '#78716C', glowColor: '#57534E',
    baseRadius: 32, explosionMult: 0.0, unlockedMult: 3.6, points: 90,
    special: 'locked',
  },
};

const BubbleState = {
  IDLE:      'IDLE',
  EXPLODING: 'EXPLODING',
  DEAD:      'DEAD',
};

class Bubble {
  constructor(x, y, type) {
    this.x    = x;
    this.y    = y;
    this.type = type;

    this.radius          = type.baseRadius;
    this.explosionRadius = type.baseRadius * type.explosionMult;

    this.state             = BubbleState.IDLE;
    this.scale             = 1;
    this.opacity           = 1;
    this.explosionProgress = 0;

    // ── Spezial-Properties ───────────────────────────────────────────────
    // Shield: Trefferanzahl
    this.hitCount  = 0;
    this.showHit   = false;   // kurzes Blink-Feedback nach erstem Treffer

    // Locked: gesperrter Zustand
    this.locked    = type.name === 'LOCKED';
  }

  containsPoint(px, py) {
    return Utils.distance(px, py, this.x, this.y) <= this.radius;
  }

  // Gibt true zurück wenn diese Bubble in Explosionsreichweite von 'other' liegt.
  // Locked Bubbles haben keinen Radius → false wenn noch gesperrt.
  isInExplosionRadius(other) {
    const r = this.locked ? 0 : this.explosionRadius;
    return Utils.distance(this.x, this.y, other.x, other.y) <= r + other.radius;
  }

  // ── Typ-Gewichte (Standard, Level 0–9) ────────────────────────────────
  static _getBaseDistribution(boardIndex) {
    const t = Math.min(boardIndex, 30) / 30;
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    return [
      { type: BubbleType.MICRO,  weight: lerp(30, 10) },
      { type: BubbleType.SMALL,  weight: lerp(35, 18) },
      { type: BubbleType.MEDIUM, weight: lerp(20, 25) },
      { type: BubbleType.LARGE,  weight: lerp(12, 25) },
      { type: BubbleType.MEGA,   weight: lerp(3,  14) },
    ];
  }

  // ── Typ-Gewichte mit Spezial-Typen (ab Level 10) ──────────────────────
  static _getFullDistribution(boardIndex) {
    const base = Bubble._getBaseDistribution(boardIndex);

    if (boardIndex < 10) return base;

    const lvl = boardIndex - 10;  // 0 ab Level 10

    // Gesamtgewicht der Basis leicht reduzieren um Platz für Spezials zu machen
    const reduction = Math.min(lvl * 0.5, 10);
    const baseTotal = base.reduce((s, e) => s + e.weight, 0);
    const scaledBase = base.map(e => ({
      ...e, weight: Math.round(e.weight * (1 - reduction / baseTotal))
    }));

    const specials = [];
    // SHIELD ab Level 10
    specials.push({ type: BubbleType.SHIELD,  weight: Math.min(3 + Math.floor(lvl * 0.3), 8) });
    // GLASS ab Level 12
    if (boardIndex >= 12)
      specials.push({ type: BubbleType.GLASS,   weight: Math.min(2 + Math.floor(lvl * 0.2), 6) });
    // PHANTOM ab Level 15
    if (boardIndex >= 15)
      specials.push({ type: BubbleType.PHANTOM, weight: Math.min(2 + Math.floor(lvl * 0.15), 5) });
    // LOCKED ab Level 18
    if (boardIndex >= 18)
      specials.push({ type: BubbleType.LOCKED,  weight: Math.min(2 + Math.floor(lvl * 0.1), 4) });

    return [...scaledBase, ...specials];
  }

  static randomType(rng, boardIndex = 0) {
    const dist = Bubble._getFullDistribution(boardIndex);
    const total = dist.reduce((s, e) => s + e.weight, 0);
    let rand = rng() * total;
    for (const entry of dist) {
      rand -= entry.weight;
      if (rand <= 0) return entry.type;
    }
    return BubbleType.SMALL;
  }
}