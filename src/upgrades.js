// upgrades.js — Star-Shop: alle 14 Upgrades

const Upgrades = (() => {

  // ── Katalog ────────────────────────────────────────────────────────────
  const CATALOG = [

    // ── Bestehende (rebalanced) ──────────────────────────────────────────

    {
      id: 'radius', label: 'Größerer Radius', icon: '🎯',
      desc: '+12px Launcher-Radius pro Stufe',
      maxLevel: 5, costPerLevel: 5,
      effect: (lvl) => lvl * 12,
    },
    {
      id: 'extra_tap', label: 'Extra Tap', icon: '➕',
      desc: 'Ein zusätzlicher Tap pro Board',
      maxLevel: 1, costPerLevel: 15,
      effect: (lvl) => lvl,
    },
    {
      id: 'chain_boost', label: 'Chain Boost', icon: '⚡',
      desc: 'Multiplikator steigt schneller',
      maxLevel: 3, costPerLevel: 8,
      effect: (lvl) => [2, 1.75, 1.5, 1.25][lvl],
    },
    {
      id: 'mega_magnet', label: 'Mega Magnet', icon: '💥',
      desc: 'MEGA Bubbles: +25% Explosionsradius',
      maxLevel: 1, costPerLevel: 20,
      effect: (lvl) => lvl * 0.25,
    },

    // ── Neue Gameplay-Upgrades ───────────────────────────────────────────

    {
      id: 'chain_inferno', label: 'Chain Inferno', icon: '🔥',
      desc: 'Jede 8./6./4. Bubble in einer Chain: 2× Score',
      maxLevel: 3, costPerLevel: 10,
      // gibt den Schritt zurück: 0 = deaktiviert, sonst jede Nth Bubble
      effect: (lvl) => [0, 8, 6, 4][lvl],
    },
    {
      id: 'reaction_boost', label: 'Kettenreaktion+', icon: '💣',
      desc: '+8% Explosionsradius aller Bubbles pro Stufe',
      maxLevel: 5, costPerLevel: 6,
      effect: (lvl) => lvl * 0.08,     // z.B. 0.24 = +24%
    },
    {
      id: 'overdrive', label: 'Overdrive', icon: '🚀',
      desc: 'Nach 10+ Chain: nächster Tap mit 1.5× Radius',
      maxLevel: 1, costPerLevel: 18,
      effect: (lvl) => lvl === 1,       // true/false
    },
    {
      id: 'bubble_magnet', label: 'Bubble Magnet', icon: '🧲',
      desc: 'SMALL & MICRO: +20% Explosionsradius pro Stufe',
      maxLevel: 2, costPerLevel: 10,
      effect: (lvl) => lvl * 0.20,
    },
    {
      id: 'precision_bonus', label: 'Präzisions-Bonus', icon: '🎖️',
      desc: 'MEGA direkt getroffen: +50% Score dieser Chain',
      maxLevel: 1, costPerLevel: 12,
      effect: (lvl) => lvl * 0.5,
    },

    // ── Score & Meta ─────────────────────────────────────────────────────

    {
      id: 'combo_keeper', label: 'Combo Keeper', icon: '🏆',
      desc: 'Multiplikator halbiert sich zwischen Taps (statt Reset)',
      maxLevel: 1, costPerLevel: 15,
      effect: (lvl) => lvl === 1,       // true/false
    },
    {
      id: 'high_roller', label: 'High Roller', icon: '📈',
      desc: 'Ab ×5 Multiplier: Score 1.5× / 2× gewertet',
      maxLevel: 2, costPerLevel: 12,
      effect: (lvl) => [1.0, 1.5, 2.0][lvl],
    },
    {
      id: 'star_collector', label: 'Star Collector', icon: '💰',
      desc: '+1 Bonus-Stern pro abgeschlossener Mission',
      maxLevel: 3, costPerLevel: 8,
      effect: (lvl) => lvl,             // 0, 1, 2 oder 3 Bonus-Sterne pro Mission
    },

    // ── Kosmetisch ────────────────────────────────────────────────────────

    {
      id: 'afterburn', label: 'Afterburn', icon: '💫',
      desc: 'Partikel leben 2× länger und leuchten stärker',
      maxLevel: 1, costPerLevel: 5,
      effect: (lvl) => lvl === 1,
    },
    {
      id: 'trail', label: 'Spiral Trail', icon: '🌀',
      desc: 'Launcher hinterlässt leuchtenden Schweif',
      maxLevel: 1, costPerLevel: 5,
      effect: (lvl) => lvl === 1,
    },
  ];

  // ── Storage Helpers ────────────────────────────────────────────────────
  function getLevel(id) {
    return Storage.get('br_upg_' + id) || 0;
  }

  function _setLevel(id, level) {
    Storage.set('br_upg_' + id, level);
  }

  // ── Kauf ──────────────────────────────────────────────────────────────
  function buy(id, currentStars) {
    const def = CATALOG.find(u => u.id === id);
    if (!def) return false;
    const lvl = getLevel(id);
    if (lvl >= def.maxLevel) return false;
    if (currentStars < def.costPerLevel) return false;
    _setLevel(id, lvl + 1);
    return true;
  }

  // ── Effekt abrufen ────────────────────────────────────────────────────
  function getEffect(id) {
    const def = CATALOG.find(u => u.id === id);
    if (!def) return 0;
    return def.effect(getLevel(id));
  }

  // ── Status für Renderer ───────────────────────────────────────────────
  function getStatus(currentStars) {
    return CATALOG.map(def => {
      const level = getLevel(def.id);
      const maxed = level >= def.maxLevel;
      return {
        id:       def.id,
        label:    def.label,
        icon:     def.icon,
        desc:     def.desc,
        level,
        maxLevel: def.maxLevel,
        cost:     def.costPerLevel,
        maxed,
        canBuy:   !maxed && currentStars >= def.costPerLevel,
      };
    });
  }

  // ── Gameplay-Konfiguration für game.js ────────────────────────────────
  function getGameConfig(baseLauncherRadius, baseTaps) {
    return {
      // Bestehend
      launcherRadius:     baseLauncherRadius + getEffect('radius'),
      maxTaps:            baseTaps + getEffect('extra_tap'),
      chainDivisor:       getEffect('chain_boost'),
      megaRadiusBoost:    getEffect('mega_magnet'),

      // Neu
      reactionBoost:      getEffect('reaction_boost'),   // +X% alle Radien
      bubbleMagnetBoost:  getEffect('bubble_magnet'),    // +X% SMALL/MICRO Radien
      chainInfernoStep:   getEffect('chain_inferno'),    // 0=off, 4/6/8=jede Nth
      overdriveEnabled:   getEffect('overdrive'),        // true/false
      precisionBonus:     getEffect('precision_bonus'),  // 0 oder 0.5
      comboKeeperEnabled: getEffect('combo_keeper'),     // true/false
      highRollerFactor:   getEffect('high_roller'),      // 1.0 / 1.5 / 2.0
      starBonusPerMission: getEffect('star_collector'),  // 0 / 1 / 2 / 3

      // Kosmetisch
      afterburnEnabled:   getEffect('afterburn'),        // true/false
      trailEnabled:       getEffect('trail'),            // true/false
    };
  }

  return { CATALOG, getLevel, buy, getEffect, getStatus, getGameConfig };
})();