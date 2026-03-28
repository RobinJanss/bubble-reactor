// upgrades.js — Star-Shop: Definitionen, Kauf-Logik, Effekte

const Upgrades = (() => {

  const CATALOG = [
    {
      id:           'radius',
      label:        'Größerer Radius',
      icon:         '🎯',
      desc:         '+12px Launcher-Radius pro Stufe',
      maxLevel:     5,
      costPerLevel: 3,
      effect: (lvl) => lvl * 12,
    },
    {
      id:           'extra_tap',
      label:        'Extra Tap',
      icon:         '➕',
      desc:         'Ein zusätzlicher Tap pro Board',
      maxLevel:     1,
      costPerLevel: 8,
      effect: (lvl) => lvl,
    },
    {
      id:           'chain_boost',
      label:        'Chain Boost',
      icon:         '⚡',
      desc:         'Multiplikator steigt schneller',
      maxLevel:     3,
      costPerLevel: 5,
      effect: (lvl) => [2, 1.75, 1.5, 1.25][lvl],
    },
    {
      id:           'mega_magnet',
      label:        'Mega Magnet',
      icon:         '💥',
      desc:         'MEGA Bubbles: +25% Explosionsradius',
      maxLevel:     1,
      costPerLevel: 12,
      effect: (lvl) => lvl * 0.25,
    },
  ];

  function getLevel(id) {
    return Storage.get('br_upg_' + id) || 0;
  }

  function _setLevel(id, level) {
    Storage.set('br_upg_' + id, level);
  }

  function buy(id, currentStars) {
    const def = CATALOG.find(u => u.id === id);
    if (!def) return false;
    const currentLevel = getLevel(id);
    if (currentLevel >= def.maxLevel) return false;
    if (currentStars < def.costPerLevel) return false;
    _setLevel(id, currentLevel + 1);
    return true;
  }

  function getEffect(id) {
    const def = CATALOG.find(u => u.id === id);
    if (!def) return 0;
    return def.effect(getLevel(id));
  }

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

  function getGameConfig(baseLauncherRadius, baseTaps) {
    return {
      launcherRadius:  baseLauncherRadius + getEffect('radius'),
      maxTaps:         baseTaps + getEffect('extra_tap'),
      chainDivisor:    getEffect('chain_boost'),
      megaRadiusBoost: getEffect('mega_magnet'),
    };
  }

  return { CATALOG, getLevel, buy, getEffect, getStatus, getGameConfig };
})();