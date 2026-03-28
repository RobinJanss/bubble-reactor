// renderer.js — Canvas Rendering aller Game States

const Renderer = (() => {

  // ── Screen-Shake + Flash ───────────────────────────────────────────────
  let _shakeIntensity = 0, _shakeDuration = 0, _shakeMaxDur = 1, _flashAlpha = 0;

  function triggerShake(intensity, frames) {
    if (intensity > _shakeIntensity) _shakeIntensity = intensity;
    if (frames > _shakeDuration) { _shakeDuration = frames; _shakeMaxDur = frames; }
  }

  function triggerFlash(alpha) {
    if (alpha > _flashAlpha) _flashAlpha = alpha;
  }

  function _applyShake(ctx) {
    if (_shakeDuration <= 0) return;
    const mag = _shakeIntensity * (_shakeDuration / _shakeMaxDur);
    ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
    _shakeDuration--;
    if (_shakeDuration <= 0) _shakeIntensity = 0;
  }

  function _drawFlash(ctx, canvas) {
    if (_flashAlpha < 0.005) { _flashAlpha = 0; return; }
    ctx.save();
    ctx.globalAlpha = _flashAlpha;
    ctx.fillStyle   = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    _flashAlpha *= 0.80;
  }

  // ── Spiral Trail ───────────────────────────────────────────────────────
  const TRAIL_MAX   = 24;
  let _trailPoints  = [];

  function _updateTrail(launcher, enabled) {
    if (!enabled || !launcher.visible) { _trailPoints = []; return; }
    _trailPoints.push({ x: launcher.x, y: launcher.y, t: 1.0 });
    if (_trailPoints.length > TRAIL_MAX) _trailPoints.shift();
    _trailPoints.forEach(p => { p.t = Math.max(0, p.t - 0.04); });
    _trailPoints = _trailPoints.filter(p => p.t > 0);
  }

  function _drawTrail(ctx) {
    if (_trailPoints.length < 2) return;
    ctx.save();
    for (let i = 1; i < _trailPoints.length; i++) {
      const a = _trailPoints[i - 1], b = _trailPoints[i];
      const alpha = b.t * 0.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(255,71,87,${alpha})`;
      ctx.lineWidth   = b.t * 4;
      ctx.shadowColor = '#FF4757';
      ctx.shadowBlur  = 8;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Button Hit-Testing ─────────────────────────────────────────────────
  let _buttons = {};
  function _registerButton(id, x, y, w, h) { _buttons[id] = { x, y, w, h }; }
  function _clearButtons() { _buttons = {}; }
  function getHitButton(canvasX, canvasY) {
    for (const [id, b] of Object.entries(_buttons)) {
      if (canvasX >= b.x && canvasX <= b.x + b.w &&
          canvasY >= b.y && canvasY <= b.y + b.h) return id;
    }
    return null;
  }

  function _drawButton(ctx, s, cx, y, id, label, bgColor, glowColor, w = 200) {
    const bw = w * s, bh = 36 * s, bx = cx - bw / 2;
    ctx.save();
    ctx.fillStyle = bgColor; ctx.shadowColor = glowColor; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.roundRect(bx, y, bw, bh, 8 * s); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.floor(13 * s)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(label, cx, y + bh * 0.66);
    ctx.restore();
    _registerButton(id, bx, y, bw, bh);
  }

  // ── Background ──────────────────────────────────────────────────────────
  function _drawBackground(ctx, canvas) {
    ctx.fillStyle = '#0D0F1A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
    const gs = Math.floor(canvas.width / 20);
    for (let x = 0; x < canvas.width; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  }

  // ── Bubble ──────────────────────────────────────────────────────────────
  function _drawBubble(ctx, bubble) {
    if (bubble.state === BubbleState.DEAD) return;
    ctx.save();
    let scale = 1, opacity = 1;
    if (bubble.state === BubbleState.EXPLODING) { scale = 1 + bubble.explosionProgress * 0.8; opacity = 1 - bubble.explosionProgress; }
    ctx.globalAlpha = opacity; ctx.translate(bubble.x, bubble.y); ctx.scale(scale, scale);
    const r = bubble.radius;
    ctx.shadowColor = bubble.type.glowColor; ctx.shadowBlur = 20;
    const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    gradient.addColorStop(0, lightenColor(bubble.type.color, 60));
    gradient.addColorStop(0.5, bubble.type.color);
    gradient.addColorStop(1, darkenColor(bubble.type.color, 40));
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.28, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    if (bubble.state === BubbleState.EXPLODING) {
      ctx.shadowColor = bubble.type.glowColor; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.arc(0, 0, bubble.explosionRadius * bubble.explosionProgress, 0, Math.PI * 2);
      ctx.strokeStyle = bubble.type.color; ctx.lineWidth = 3 * (1 - bubble.explosionProgress);
      ctx.globalAlpha = (1 - bubble.explosionProgress) * 0.6; ctx.stroke();
    }
    ctx.restore();
  }

  // ── Launcher (mit Overdrive-Glow) ───────────────────────────────────────
  function _drawLauncher(ctx, canvas, info) {
    const launcher = info.launcher;
    if (!launcher || !launcher.visible) return;
    if (info.tapsUsed >= info.tapsMax) return;
    const s = canvas.width / 836, x = launcher.x, y = launcher.y;
    const r = 22 * s, explR = info.launcherRadius;
    const isOverdrive = !!info.overdrivePending;

    ctx.save();

    // Trail zeichnen
    _drawTrail(ctx);

    // Radius-Ring
    const pulse = 0.4 + Math.sin(Date.now() / 300) * 0.15;
    ctx.globalAlpha = isOverdrive ? 0.8 : pulse;
    ctx.beginPath(); ctx.arc(x, y, explR, 0, Math.PI * 2);
    ctx.strokeStyle = isOverdrive ? '#FFE600' : '#FFFFFF';
    ctx.lineWidth   = (isOverdrive ? 2.5 : 1.5) * s;
    ctx.setLineDash([6 * s, 4 * s]); ctx.stroke(); ctx.setLineDash([]);

    ctx.globalAlpha = 1;
    ctx.shadowColor = isOverdrive ? '#FFE600' : '#FF4757';
    ctx.shadowBlur  = isOverdrive ? 35 : 25;

    const c0 = isOverdrive ? '#FFDD57' : '#FF8C8C';
    const c1 = isOverdrive ? '#F59E0B' : '#FF4757';
    const c2 = isOverdrive ? '#B45309' : '#AA1122';
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, c0); grad.addColorStop(0.5, c1); grad.addColorStop(1, c2);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();

    const btnLabel = isOverdrive ? '⚡' : 'KLICK';
    ctx.fillStyle = isOverdrive ? '#FFE600' : 'rgba(255,255,255,0.7)';
    ctx.font      = `bold ${Math.floor(10 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(btnLabel, x, y + r + 14 * s);
    ctx.restore();
  }

  // ── Missions Panel ──────────────────────────────────────────────────────
  function _drawMissionsPanel(ctx, canvas, info) {
    const s = canvas.width / 836, missions = info.missions || [];
    if (missions.length === 0) return;
    const panelX = 12 * s, panelY = canvas.height * 0.12;
    const panelW = 160 * s, panelH = 100 * s;
    ctx.save();
    ctx.fillStyle = 'rgba(13,15,26,0.80)';
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 8 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(0,198,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `bold ${Math.floor(10 * s)}px sans-serif`;
    ctx.textAlign = 'left'; ctx.fillText('MISSIONEN', panelX + 8 * s, panelY + 14 * s);
    missions.forEach((m, i) => {
      const my = panelY + 28 * s + i * 24 * s;
      ctx.font = `${Math.floor(13 * s)}px sans-serif`;
      ctx.fillStyle = m.completed ? '#FFE600' : 'rgba(255,255,255,0.2)';
      if (m.completed) { ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 8; } else ctx.shadowBlur = 0;
      ctx.fillText('★', panelX + 8 * s, my + 10 * s); ctx.shadowBlur = 0;
      ctx.font = `${Math.floor(11 * s)}px sans-serif`;
      ctx.fillStyle = m.completed ? '#FFFFFF' : 'rgba(255,255,255,0.4)';
      ctx.fillText(m.label, panelX + 24 * s, my + 10 * s);
    });
    ctx.restore();
  }

  // ── Level Badge ─────────────────────────────────────────────────────────
  function _drawLevelBadge(ctx, canvas, level) {
    const s = canvas.width / 836, cx = canvas.width / 2;
    const label = `LEVEL ${level}`;
    ctx.save();
    ctx.font = `bold ${Math.floor(13 * s)}px sans-serif`;
    const tw = ctx.measureText(label).width;
    const pw = tw + 20 * s, ph = 22 * s, px = cx - pw / 2, py = 6 * s;
    ctx.fillStyle = 'rgba(0,198,255,0.15)'; ctx.strokeStyle = 'rgba(0,198,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, ph / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#00C6FF'; ctx.shadowColor = '#00C6FF'; ctx.shadowBlur = 8;
    ctx.textAlign = 'center'; ctx.fillText(label, cx, py + ph * 0.72);
    ctx.restore();
  }

  // ── IDLE ────────────────────────────────────────────────────────────────
  function _drawIdle(ctx, canvas, info) {
    const cx = canvas.width / 2, s = canvas.width / 836;
    _drawMissionsPanel(ctx, canvas, info);
    _drawLevelBadge(ctx, canvas, info.level);
    ctx.save();
    ctx.fillStyle = '#00C6FF'; ctx.font = `bold ${Math.floor(48 * s)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.shadowColor = '#00C6FF'; ctx.shadowBlur = 30;
    ctx.fillText('BUBBLE REACTOR', cx, canvas.height * 0.52);
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${Math.floor(18 * s)}px sans-serif`;
    ctx.fillText('Bewege die Maus — klicke zum Zünden', cx, canvas.height * 0.58);
    ctx.fillStyle = '#FFE600'; ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 10;
    ctx.font = `bold ${Math.floor(14 * s)}px sans-serif`;
    ctx.fillText(`★ ${info.totalStars}`, cx, canvas.height * 0.63);
    ctx.shadowBlur = 0;
    const pulse = 0.8 + Math.sin(Date.now() / 400) * 0.2;
    ctx.globalAlpha = pulse; ctx.fillStyle = '#39FF14';
    ctx.font = `bold ${Math.floor(16 * s)}px sans-serif`;
    ctx.fillText('▼  KLICK ZUM STARTEN  ▼', cx, canvas.height * 0.69);
    ctx.restore();
  }

  // ── HUD ─────────────────────────────────────────────────────────────────
  function _drawHUD(ctx, canvas, info) {
    const s = canvas.width / 836;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `bold ${Math.floor(22 * s)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`${info.totalScore.toLocaleString()} pts`, canvas.width - 16 * s, 34 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `bold ${Math.floor(11 * s)}px sans-serif`;
    ctx.textAlign = 'left'; ctx.fillText('TAPS', 16 * s, 20 * s);
    for (let i = 0; i < info.tapsMax; i++) {
      const filled = i < (info.tapsMax - info.tapsUsed);
      const cx2 = (22 + i * 26) * s, cy2 = 34 * s, r = 9 * s;
      ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, Math.PI * 2);
      if (filled) { ctx.fillStyle = '#00C6FF'; ctx.shadowColor = '#00C6FF'; ctx.shadowBlur = 10; ctx.fill(); }
      else { ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.shadowBlur = 0;
    }
    // Overdrive-Indikator
    if (info.overdrivePending) {
      ctx.fillStyle = '#FFE600'; ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 12;
      ctx.font = `bold ${Math.floor(11 * s)}px sans-serif`; ctx.textAlign = 'left';
      ctx.fillText('⚡ OVERDRIVE BEREIT', 16 * s, 52 * s); ctx.shadowBlur = 0;
    }
    _drawLevelBadge(ctx, canvas, info.level);
    if (info.chainLength > 0) {
      ctx.textAlign = 'center'; ctx.font = `bold ${Math.floor(30 * s)}px sans-serif`;
      ctx.fillStyle = '#FFE600'; ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 20;
      ctx.fillText(`×${info.multiplier}  ${info.chainLength} CHAIN`, canvas.width / 2, 38 * s);
      ctx.shadowBlur = 0;
    }
    _drawMissionsPanel(ctx, canvas, info);
    ctx.restore();
  }

  // ── Result Screen ───────────────────────────────────────────────────────
  function _drawResult(ctx, canvas, result, info) {
    if (!result) return;
    const cx = canvas.width / 2, cy = canvas.height / 2, s = canvas.width / 836;
    _clearButtons();
    ctx.save();
    ctx.fillStyle = 'rgba(13,15,26,0.92)';
    ctx.beginPath(); ctx.roundRect(cx - 220 * s, cy - 185 * s, 440 * s, 420 * s, 16 * s); ctx.fill();
    ctx.strokeStyle = '#00C6FF'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = `${Math.floor(12 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`BOARD ${info.boardIndex + 1}  ·  LEVEL ${info.level}`, cx, cy - 162 * s);
    ctx.fillStyle = '#FFFFFF'; ctx.font = `bold ${Math.floor(38 * s)}px sans-serif`;
    ctx.shadowColor = '#00C6FF'; ctx.shadowBlur = 15;
    ctx.fillText(`${info.totalScore.toLocaleString()} pts`, cx, cy - 120 * s); ctx.shadowBlur = 0;
    const bestChain = Math.max(0, ...(info.tapsResults || []).map(r => r.chainLength));
    ctx.fillStyle = '#FFE600'; ctx.font = `${Math.floor(15 * s)}px sans-serif`;
    ctx.fillText(`Beste Chain: ${bestChain}`, cx, cy - 88 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `bold ${Math.floor(11 * s)}px sans-serif`;
    ctx.fillText('MISSIONEN', cx, cy - 60 * s);
    const missions = info.missions || [], starsEarned = missions.filter(m => m.completed).length;
    missions.forEach((m, i) => {
      const my = cy - 38 * s + i * 32 * s;
      ctx.font = `${Math.floor(18 * s)}px sans-serif`;
      if (m.completed) { ctx.fillStyle = '#FFE600'; ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 10; }
      else { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.shadowBlur = 0; }
      ctx.fillText('★', cx - 100 * s, my + 6 * s); ctx.shadowBlur = 0;
      ctx.textAlign = 'left'; ctx.font = `${Math.floor(14 * s)}px sans-serif`;
      ctx.fillStyle = m.completed ? '#FFFFFF' : 'rgba(255,255,255,0.35)';
      ctx.fillText(m.label, cx - 78 * s, my + 6 * s); ctx.textAlign = 'center';
    });
    ctx.font = `${Math.floor(22 * s)}px sans-serif`;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < starsEarned ? '#FFE600' : 'rgba(255,255,255,0.15)';
      if (i < starsEarned) { ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 12; } else ctx.shadowBlur = 0;
      ctx.fillText('★', cx + (i - 1) * 30 * s, cy + 68 * s);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = `${Math.floor(12 * s)}px sans-serif`;
    ctx.fillText(`Gesamt ★ ${info.totalStars}`, cx, cy + 88 * s);
    const hs = Storage.get(Storage.KEYS.HIGH_SCORE) || 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = `${Math.floor(11 * s)}px sans-serif`;
    ctx.fillText(`Rekord: ${hs.toLocaleString()} pts`, cx, cy + 104 * s);
    ctx.restore();
    const gap = 44 * s; let btnY = cy + 116 * s;
    _drawButton(ctx, s, cx, btnY, 'next', '▶  Nächstes Board', '#16A34A', '#22C55E'); btnY += gap;
    if (!info.retryUsed) { _drawButton(ctx, s, cx, btnY, 'retry', '▶  Nochmal (Werbung)', '#B45309', '#F59E0B'); btnY += gap; }
    _drawButton(ctx, s, cx, btnY, 'shop', '🛒  Upgrade Shop', '#6D28D9', '#8B5CF6'); btnY += gap;
    if (!info.dailyPlayedToday) _drawButton(ctx, s, cx, btnY, 'daily', '📅  Daily Board', '#4338CA', '#6366F1');
  }

  // ── Shop Screen (scrollbar, 14 Upgrades) ───────────────────────────────
  function _drawShop(ctx, canvas, info) {
    const cx = canvas.width / 2, s = canvas.width / 836;
    const upgrades = info.upgradeStatus || [];
    _clearButtons();

    // Vollbild-Overlay
    ctx.save();
    ctx.fillStyle = 'rgba(5,7,15,0.97)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Titel
    ctx.fillStyle = '#8B5CF6'; ctx.font = `bold ${Math.floor(22 * s)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.shadowColor = '#8B5CF6'; ctx.shadowBlur = 18;
    ctx.fillText('✦  UPGRADE SHOP  ✦', cx, 38 * s); ctx.shadowBlur = 0;

    // Guthaben
    ctx.fillStyle = '#FFE600'; ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 10;
    ctx.font = `bold ${Math.floor(15 * s)}px sans-serif`;
    ctx.fillText(`★ ${info.totalStars}  verfügbar`, cx, 60 * s); ctx.shadowBlur = 0;

    // Trennlinie
    ctx.strokeStyle = 'rgba(139,92,246,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20 * s, 70 * s); ctx.lineTo(canvas.width - 20 * s, 70 * s); ctx.stroke();

    // Upgrade-Einträge (2 Spalten)
    const colW   = (canvas.width - 32 * s) / 2;
    const rowH   = 80 * s;
    const startY = 78 * s;
    const cols   = 2;

    upgrades.forEach((upg, i) => {
      const col  = i % cols;
      const row  = Math.floor(i / cols);
      const cellX = 16 * s + col * colW;
      const cellY = startY + row * rowH;

      // Zellen-Hintergrund
      ctx.save();
      ctx.fillStyle = upg.maxed ? 'rgba(110,231,183,0.06)' : 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = upg.maxed ? 'rgba(110,231,183,0.25)' : 'rgba(139,92,246,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(cellX + 2 * s, cellY + 2 * s, colW - 8 * s, rowH - 6 * s, 8 * s);
      ctx.fill(); ctx.stroke();

      // Icon
      ctx.font = `${Math.floor(18 * s)}px sans-serif`; ctx.textAlign = 'left';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(upg.icon, cellX + 10 * s, cellY + 26 * s);

      // Label
      ctx.font = `bold ${Math.floor(12 * s)}px sans-serif`;
      ctx.fillStyle = upg.maxed ? '#6EE7B7' : '#FFFFFF';
      ctx.fillText(upg.label, cellX + 34 * s, cellY + 22 * s);

      // Beschreibung
      ctx.font = `${Math.floor(10 * s)}px sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.45)';
      // Kurze Desc (Truncate wenn nötig)
      const maxDescW = colW - 44 * s;
      ctx.save();
      ctx.rect(cellX + 34 * s, cellY, maxDescW, rowH); ctx.clip();
      ctx.fillText(upg.desc, cellX + 34 * s, cellY + 36 * s);
      ctx.restore();

      // Stufen-Dots
      for (let dot = 0; dot < upg.maxLevel; dot++) {
        ctx.beginPath(); ctx.arc(cellX + 34 * s + dot * 12 * s, cellY + 50 * s, 3.5 * s, 0, Math.PI * 2);
        ctx.fillStyle = dot < upg.level ? '#8B5CF6' : 'rgba(255,255,255,0.15)'; ctx.fill();
      }

      // Kauf-Button
      const btnW = 64 * s, btnH = 24 * s;
      const btnX = cellX + colW - 74 * s, btnY2 = cellY + rowH - 36 * s;
      if (upg.maxed) {
        ctx.fillStyle = 'rgba(110,231,183,0.15)';
        ctx.beginPath(); ctx.roundRect(btnX, btnY2, btnW, btnH, 5 * s); ctx.fill();
        ctx.fillStyle = '#6EE7B7'; ctx.font = `bold ${Math.floor(10 * s)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.fillText('MAX ✓', btnX + btnW / 2, btnY2 + btnH * 0.7);
      } else {
        ctx.fillStyle = upg.canBuy ? '#7C3AED' : 'rgba(255,255,255,0.07)';
        ctx.shadowColor = upg.canBuy ? '#8B5CF6' : 'transparent';
        ctx.shadowBlur  = upg.canBuy ? 8 : 0;
        ctx.beginPath(); ctx.roundRect(btnX, btnY2, btnW, btnH, 5 * s); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = upg.canBuy ? '#FFFFFF' : 'rgba(255,255,255,0.25)';
        ctx.font = `bold ${Math.floor(10 * s)}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(`★ ${upg.cost}`, btnX + btnW / 2, btnY2 + btnH * 0.7);
        if (upg.canBuy) _registerButton('buy_' + upg.id, btnX, btnY2, btnW, btnH);
      }
      ctx.restore();
    });

    ctx.restore();

    // Zurück-Button unten
    const backY = canvas.height - 50 * s;
    _drawButton(ctx, s, cx, backY, 'shop_back', '← Weiter spielen', '#374151', '#6B7280', 200);
  }

  // ── Haupt-Render ────────────────────────────────────────────────────────
  function draw(ctx, canvas, state, bubbles, lastResult, info) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    _applyShake(ctx);
    _drawBackground(ctx, canvas);

    // Trail Update (muss vor dem Launcher-Draw passieren)
    _updateTrail(info.launcher || {}, info.trailEnabled);

    if (state !== 'SHOP') {
      bubbles.forEach(b => _drawBubble(ctx, b));
      if (typeof Particles !== 'undefined') Particles.draw(ctx);
    }

    switch (state) {
      case 'IDLE':
        _drawIdle(ctx, canvas, info);
        _drawLauncher(ctx, canvas, info);
        break;
      case 'PLAYING':
        _drawHUD(ctx, canvas, info);
        _drawLauncher(ctx, canvas, info);
        break;
      case 'EXPLODING':
        _drawHUD(ctx, canvas, info);
        break;
      case 'RESULT':
        _drawHUD(ctx, canvas, info);
        _drawResult(ctx, canvas, lastResult, info);
        break;
      case 'SHOP':
        _drawShop(ctx, canvas, info);
        break;
    }

    ctx.restore();
    _drawFlash(ctx, canvas);
  }

  function lightenColor(hex, amount) { return _shiftColor(hex, amount); }
  function darkenColor(hex, amount)  { return _shiftColor(hex, -amount); }
  function _shiftColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    return `rgb(${Math.min(255,Math.max(0,(num>>16)+amount))},${Math.min(255,Math.max(0,((num>>8)&0xff)+amount))},${Math.min(255,Math.max(0,(num&0xff)+amount))})`;
  }

  return { draw, triggerShake, triggerFlash, getHitButton };
})();