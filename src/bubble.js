// bubble.js — Bubble Klasse + alle Typen inkl. VOID (Prestige P2)

const BubbleType = {
  // ── Standard ───────────────────────────────────────────────────────────
  MICRO:  { name: 'MICRO',  color: '#00C6FF', glowColor: '#0099CC', baseRadius: 18, explosionMult: 2.5, points: 10  },
  SMALL:  { name: 'SMALL',  color: '#39FF14', glowColor: '#22CC00', baseRadius: 24, explosionMult: 3.0, points: 25  },
  MEDIUM: { name: 'MEDIUM', color: '#FFE600', glowColor: '#CCA800', baseRadius: 30, explosionMult: 3.5, points: 50  },
  LARGE:  { name: 'LARGE',  color: '#FF8C00', glowColor: '#CC6600', baseRadius: 38, explosionMult: 4.0, points: 100 },
  MEGA:   { name: 'MEGA',   color: '#FF4757', glowColor: '#CC1122', baseRadius: 48, explosionMult: 5.0, points: 250 },

  // ── Spezial (ab Level 10) ──────────────────────────────────────────────
  SHIELD:  { name: 'SHIELD',  color: '#A78BFA', glowColor: '#7C3AED', baseRadius: 34, explosionMult: 3.8, points: 120, special: 'shield'  },
  GLASS:   { name: 'GLASS',   color: '#BAE6FD', glowColor: '#7DD3FC', baseRadius: 22, explosionMult: 0.0, points: 15,  special: 'glass'   },
  PHANTOM: { name: 'PHANTOM', color: '#D1FAE5', glowColor: '#6EE7B7', baseRadius: 28, explosionMult: 3.5, points: 200, special: 'phantom' },
  LOCKED:  { name: 'LOCKED',  color: '#78716C', glowColor: '#57534E', baseRadius: 32, explosionMult: 0.0, unlockedMult: 3.6, points: 90, special: 'locked' },

  // ── VOID (nur nach Prestige P2) ────────────────────────────────────────
  // Extrem seltene Bubble. Massive Explosion, hohe Punkte, nur als Prestige-Belohnung.
  VOID: { name: 'VOID', color: '#1E1B4B', glowColor: '#7C3AED', baseRadius: 44, explosionMult: 6.5, points: 500, special: 'void' },
};

const BubbleState = {
  IDLE:      'IDLE',
  EXPLODING: 'EXPLODING',
  DEAD:      'DEAD',
};

class Bubble {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type;
    this.radius          = type.baseRadius;
    this.explosionRadius = type.baseRadius * type.explosionMult;
    this.state           = BubbleState.IDLE;
    this.scale = 1; this.opacity = 1; this.explosionProgress = 0;
    this.hitCount = 0; this.showHit = false;
    this.locked   = type.name === 'LOCKED';
  }

  containsPoint(px, py) {
    return Utils.distance(px, py, this.x, this.y) <= this.radius;
  }

  isInExplosionRadius(other) {
    const r = this.locked ? 0 : this.explosionRadius;
    return Utils.distance(this.x, this.y, other.x, other.y) <= r + other.radius;
  }

  // ── Typ-Verteilungen ───────────────────────────────────────────────────
  static _getBaseDistribution(boardIndex) {
    const t = Math.min(boardIndex, 30) / 30;
    const lerp = (a, b) => Math.round(a + (b-a)*t);
    return [
      { type: BubbleType.MICRO,  weight: lerp(30, 10) },
      { type: BubbleType.SMALL,  weight: lerp(35, 18) },
      { type: BubbleType.MEDIUM, weight: lerp(20, 25) },
      { type: BubbleType.LARGE,  weight: lerp(12, 25) },
      { type: BubbleType.MEGA,   weight: lerp(3,  14) },
    ];
  }

  static _getFullDistribution(boardIndex, prestigeLevel = 0) {
    const base = Bubble._getBaseDistribution(boardIndex);
    const specials = [];

    // Spezial-Typen ab Level 10
    if (boardIndex >= 10) {
      const lvl = boardIndex - 10;
      const r = Math.min(3 + Math.floor(lvl*.3), 8);
      specials.push({ type: BubbleType.SHIELD,  weight: r });
      if (boardIndex >= 12) specials.push({ type: BubbleType.GLASS,   weight: Math.min(2+Math.floor(lvl*.2),6) });
      if (boardIndex >= 15) specials.push({ type: BubbleType.PHANTOM, weight: Math.min(2+Math.floor(lvl*.15),5) });
      if (boardIndex >= 18) specials.push({ type: BubbleType.LOCKED,  weight: Math.min(2+Math.floor(lvl*.1),4) });
    }

    // VOID: nur nach Prestige P2, sehr selten
    if (prestigeLevel >= 2) {
      specials.push({ type: BubbleType.VOID, weight: 2 });
    }

    if (specials.length === 0) return base;

    const totalSpecial = specials.reduce((s,e) => s+e.weight, 0);
    const baseTotal    = base.reduce((s,e) => s+e.weight, 0);
    const scaledBase   = base.map(e => ({ ...e, weight: Math.round(e.weight * (1 - totalSpecial/(baseTotal+totalSpecial))) }));
    return [...scaledBase, ...specials];
  }

  static randomType(rng, boardIndex = 0, prestigeLevel = 0) {
    const dist  = Bubble._getFullDistribution(boardIndex, prestigeLevel);
    const total = dist.reduce((s,e) => s+e.weight, 0);
    let rand = rng() * total;
    for (const entry of dist) { rand -= entry.weight; if (rand <= 0) return entry.type; }
    return BubbleType.SMALL;
  }
}