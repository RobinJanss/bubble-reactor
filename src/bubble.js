// bubble.js — Bubble Klasse
// Grundeinheit des Spiels. Jede Blase hat Typ, Position, Radius und State.

const BubbleType = {
  MICRO:  { name: 'MICRO',  color: '#00C6FF', glowColor: '#0099CC', baseRadius: 18, explosionMult: 1.5, points: 10  },
  SMALL:  { name: 'SMALL',  color: '#39FF14', glowColor: '#22CC00', baseRadius: 24, explosionMult: 2.0, points: 25  },
  MEDIUM: { name: 'MEDIUM', color: '#FFE600', glowColor: '#CCA800', baseRadius: 30, explosionMult: 2.5, points: 50  },
  LARGE:  { name: 'LARGE',  color: '#FF8C00', glowColor: '#CC6600', baseRadius: 38, explosionMult: 3.0, points: 100 },
  MEGA:   { name: 'MEGA',   color: '#FF4757', glowColor: '#CC1122', baseRadius: 48, explosionMult: 4.0, points: 250 },
};

// Verteilung der Bubble-Typen (je nach Board-Schwierigkeit)
const BubbleDistribution = [
  { type: BubbleType.MICRO,  weight: 30 },
  { type: BubbleType.SMALL,  weight: 35 },
  { type: BubbleType.MEDIUM, weight: 20 },
  { type: BubbleType.LARGE,  weight: 12 },
  { type: BubbleType.MEGA,   weight: 3  },
];

const BubbleState = {
  IDLE:      'IDLE',
  EXPLODING: 'EXPLODING',
  DEAD:      'DEAD',
};

class Bubble {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = type.baseRadius;
    this.explosionRadius = type.baseRadius * type.explosionMult;
    this.state = BubbleState.IDLE;

    // Animations-State
    this.scale = 1;
    this.opacity = 1;
    this.explosionProgress = 0; // 0→1 während Explosion
  }

  // Gibt zurück ob ein Punkt (px, py) diese Bubble trifft
  containsPoint(px, py) {
    return Utils.distance(px, py, this.x, this.y) <= this.radius;
  }

  // Gibt zurück ob eine andere Bubble im Explosionsradius liegt
  isInExplosionRadius(other) {
    return Utils.distance(this.x, this.y, other.x, other.y)
      <= this.explosionRadius + other.radius;
  }

  // Bubble-Typ per gewichteter Zufallsauswahl
  static randomType(rng) {
    const totalWeight = BubbleDistribution.reduce((s, e) => s + e.weight, 0);
    let rand = rng() * totalWeight;
    for (const entry of BubbleDistribution) {
      rand -= entry.weight;
      if (rand <= 0) return entry.type;
    }
    return BubbleType.SMALL;
  }
}