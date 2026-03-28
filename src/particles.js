// particles.js — Partikel-System für Explosionen

const Particles = (() => {
  let _particles      = [];
  let _afterburnActive = false;   // Afterburn Upgrade

  function setAfterburnActive(val) { _afterburnActive = val; }

  function emit(x, y, color, count = 12) {
    const lifeMult  = _afterburnActive ? 2.0 : 1.0;
    const glowMult  = _afterburnActive ? 2.0 : 1.0;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      _particles.push({
        x, y,
        vx:      Math.cos(angle) * speed,
        vy:      Math.sin(angle) * speed,
        radius:  2 + Math.random() * 3,
        color,
        opacity: 1,
        life:    1,
        decay:   (0.02 + Math.random() * 0.03) / lifeMult,
        gravity: 0.08,
        glow:    glowMult,
      });
    }
  }

  function update(dt) {
    const factor   = dt / 16;
    _particles = _particles.filter(p => p.life > 0);
    _particles.forEach(p => {
      p.x  += p.vx * factor;
      p.y  += p.vy * factor;
      p.vy += p.gravity * factor;
      p.life   -= p.decay * factor;
      p.opacity = Math.max(0, p.life);
    });
  }

  function draw(ctx) {
    _particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha  = p.opacity;
      ctx.fillStyle    = p.color;
      ctx.shadowColor  = p.color;
      ctx.shadowBlur   = 6 * (p.glow || 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function clear() { _particles = []; }

  return { emit, update, draw, clear, setAfterburnActive };
})();