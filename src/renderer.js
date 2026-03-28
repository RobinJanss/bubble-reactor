// renderer.js — Canvas Rendering aller Game States

const Renderer = (() => {

  // ── Screen-Shake + Flash ───────────────────────────────────────────────
  let _shakeIntensity = 0, _shakeDuration = 0, _shakeMaxDur = 1, _flashAlpha = 0;

  function triggerShake(i, f) {
    if (i > _shakeIntensity) _shakeIntensity = i;
    if (f > _shakeDuration) { _shakeDuration = f; _shakeMaxDur = f; }
  }
  function triggerFlash(a) { if (a > _flashAlpha) _flashAlpha = a; }

  function _applyShake(ctx) {
    if (_shakeDuration <= 0) return;
    const mag = _shakeIntensity * (_shakeDuration / _shakeMaxDur);
    ctx.translate((Math.random()*2-1)*mag, (Math.random()*2-1)*mag);
    if (--_shakeDuration <= 0) _shakeIntensity = 0;
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
  const TRAIL_MAX = 24;
  let _trailPoints = [];

  function _updateTrail(launcher, enabled) {
    if (!enabled || !launcher?.visible) { _trailPoints = []; return; }
    _trailPoints.push({ x: launcher.x, y: launcher.y, t: 1.0 });
    if (_trailPoints.length > TRAIL_MAX) _trailPoints.shift();
    _trailPoints.forEach(p => { p.t = Math.max(0, p.t - 0.04); });
    _trailPoints = _trailPoints.filter(p => p.t > 0);
  }

  function _drawTrail(ctx) {
    if (_trailPoints.length < 2) return;
    ctx.save();
    for (let i = 1; i < _trailPoints.length; i++) {
      const a = _trailPoints[i-1], b = _trailPoints[i];
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(255,71,87,${b.t*0.5})`;
      ctx.lineWidth   = b.t * 4;
      ctx.shadowColor = '#FF4757'; ctx.shadowBlur = 8;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Button Hit-Testing ─────────────────────────────────────────────────
  let _buttons = {};
  function _registerButton(id, x, y, w, h) { _buttons[id] = { x, y, w, h }; }
  function _clearButtons() { _buttons = {}; }
  function getHitButton(cx, cy) {
    for (const [id, b] of Object.entries(_buttons))
      if (cx >= b.x && cx <= b.x+b.w && cy >= b.y && cy <= b.y+b.h) return id;
    return null;
  }

  function _drawButton(ctx, s, cx, y, id, label, bg, glow, w = 200) {
    const bw = w*s, bh = 36*s, bx = cx - bw/2;
    ctx.save();
    ctx.fillStyle = bg; ctx.shadowColor = glow; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.roundRect(bx, y, bw, bh, 8*s); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.floor(13*s)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(label, cx, y + bh*0.66);
    ctx.restore();
    _registerButton(id, bx, y, bw, bh);
  }

  // ── Background ──────────────────────────────────────────────────────────
  function _drawBackground(ctx, canvas) {
    ctx.fillStyle = '#0D0F1A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'; ctx.lineWidth = 1;
    const gs = Math.floor(canvas.width / 20);
    for (let x = 0; x < canvas.width; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
  }

  // ── Standard Bubble ─────────────────────────────────────────────────────
  function _drawStandardBubble(ctx, r, bubble) {
    ctx.shadowColor = bubble.type.glowColor; ctx.shadowBlur = 20;
    const g = ctx.createRadialGradient(-r*.3, -r*.3, r*.1, 0, 0, r);
    g.addColorStop(0, lightenColor(bubble.type.color, 60));
    g.addColorStop(.5, bubble.type.color);
    g.addColorStop(1, darkenColor(bubble.type.color, 40));
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(-r*.28, -r*.28, r*.25, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
  }

  function _drawShieldBubble(ctx, r, bubble) {
    const dmg = bubble.hitCount >= 1;
    ctx.shadowColor = '#7C3AED'; ctx.shadowBlur = dmg ? 30 : 15;
    const g = ctx.createRadialGradient(-r*.3,-r*.3,r*.1,0,0,r);
    g.addColorStop(0, dmg ? '#C4B5FD' : '#DDD6FE');
    g.addColorStop(.5, dmg ? '#8B5CF6' : '#A78BFA');
    g.addColorStop(1, dmg ? '#4C1D95' : '#6D28D9');
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0,-r*.45); ctx.lineTo(r*.35,-r*.2); ctx.lineTo(r*.35,r*.1);
    ctx.lineTo(0,r*.45); ctx.lineTo(-r*.35,r*.1); ctx.lineTo(-r*.35,-r*.2);
    ctx.closePath();
    ctx.strokeStyle = dmg ? 'rgba(196,181,253,0.5)' : 'rgba(255,255,255,0.7)';
    ctx.lineWidth = dmg ? 1 : 2; ctx.stroke();
    ctx.fillStyle = dmg ? 'rgba(250,204,21,0.9)' : 'rgba(255,255,255,0.8)';
    ctx.font = `bold ${Math.floor(r*.4)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(dmg ? '!' : '2', 0, r*.15);
    if (bubble.showHit) { ctx.globalAlpha *= 0.4; ctx.fillStyle='#FFF'; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); }
  }

  function _drawGlassBubble(ctx, r, bubble) {
    ctx.shadowColor = '#7DD3FC'; ctx.shadowBlur = 10;
    ctx.globalAlpha *= 0.55;
    const g = ctx.createRadialGradient(-r*.3,-r*.3,r*.05,0,0,r);
    g.addColorStop(0,'rgba(224,242,254,0.9)'); g.addColorStop(.5,'rgba(186,230,253,0.5)'); g.addColorStop(1,'rgba(125,211,252,0.3)');
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.setLineDash([3,3]); ctx.strokeStyle='rgba(186,230,253,0.8)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-r*.15,-r*.2); ctx.lineTo(0,0); ctx.lineTo(r*.1,r*.25); ctx.stroke();
  }

  function _drawPhantomBubble(ctx, r, bubble) {
    const pulse = 0.5 + Math.sin(Date.now()/400)*0.25;
    ctx.shadowColor='#6EE7B7'; ctx.shadowBlur=25*pulse;
    ctx.globalAlpha *= pulse;
    const g = ctx.createRadialGradient(0,0,0,0,0,r);
    g.addColorStop(0,'rgba(209,250,229,0.7)'); g.addColorStop(1,'rgba(110,231,183,0.1)');
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.shadowBlur=0; ctx.setLineDash([4,4]);
    ctx.strokeStyle=`rgba(110,231,183,${pulse})`; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle=`rgba(110,231,183,${pulse*0.9})`;
    ctx.font=`bold ${Math.floor(r*.55)}px sans-serif`; ctx.textAlign='center';
    ctx.fillText('?', 0, r*.2);
  }

  function _drawLockedBubble(ctx, r, bubble) {
    const unlocked = !bubble.locked;
    ctx.shadowColor = unlocked ? '#A78BFA' : '#57534E'; ctx.shadowBlur = unlocked ? 20 : 8;
    const col = unlocked ? '#A78BFA' : '#78716C';
    const g = ctx.createRadialGradient(-r*.3,-r*.3,r*.1,0,0,r);
    g.addColorStop(0,lightenColor(col,30)); g.addColorStop(1,darkenColor(col,30));
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.shadowBlur=0;
    ctx.font=`${Math.floor(r*.6)}px sans-serif`; ctx.textAlign='center';
    ctx.fillStyle = unlocked ? 'rgba(167,139,250,0.9)' : 'rgba(255,255,255,0.6)';
    ctx.fillText(unlocked ? '✓' : '🔒', 0, r*.22);
    if (bubble.showHit) { ctx.globalAlpha*=0.5; ctx.fillStyle='#A78BFA'; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill(); }
  }

  function _drawBubble(ctx, bubble) {
    if (bubble.state === BubbleState.DEAD) return;
    ctx.save();
    let scale=1, opacity=1;
    if (bubble.state === BubbleState.EXPLODING) { scale=1+bubble.explosionProgress*.8; opacity=1-bubble.explosionProgress; }
    ctx.globalAlpha=opacity; ctx.translate(bubble.x, bubble.y); ctx.scale(scale, scale);
    const r = bubble.radius, n = bubble.type.name;
    if      (n==='SHIELD')  _drawShieldBubble(ctx, r, bubble);
    else if (n==='GLASS')   _drawGlassBubble(ctx, r, bubble);
    else if (n==='PHANTOM') _drawPhantomBubble(ctx, r, bubble);
    else if (n==='LOCKED')  _drawLockedBubble(ctx, r, bubble);
    else                    _drawStandardBubble(ctx, r, bubble);
    if (bubble.state === BubbleState.EXPLODING) {
      ctx.shadowColor=bubble.type.glowColor; ctx.shadowBlur=15;
      ctx.beginPath(); ctx.arc(0,0,bubble.explosionRadius*bubble.explosionProgress,0,Math.PI*2);
      ctx.strokeStyle=bubble.type.color; ctx.lineWidth=3*(1-bubble.explosionProgress);
      ctx.globalAlpha=(1-bubble.explosionProgress)*.6; ctx.stroke();
    }
    ctx.restore();
  }

  // ── Launcher ────────────────────────────────────────────────────────────
  function _drawLauncher(ctx, canvas, info) {
    if (!info.launcher?.visible) return;
    if (info.tapsUsed >= info.tapsMax) return;
    const s=canvas.width/836, x=info.launcher.x, y=info.launcher.y;
    const r=22*s, explR=info.launcherRadius, od=!!info.overdrivePending;
    ctx.save();
    _drawTrail(ctx);
    const pulse = 0.4+Math.sin(Date.now()/300)*.15;
    ctx.globalAlpha = od ? 0.9 : pulse;
    ctx.beginPath(); ctx.arc(x,y,explR,0,Math.PI*2);
    ctx.strokeStyle = od?'#FFE600':'#FFFFFF'; ctx.lineWidth=(od?2.5:1.5)*s;
    ctx.setLineDash([6*s,4*s]); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha=1; ctx.shadowColor=od?'#FFE600':'#FF4757'; ctx.shadowBlur=od?35:25;
    const g=ctx.createRadialGradient(x-r*.3,y-r*.3,r*.1,x,y,r);
    g.addColorStop(0,od?'#FFDD57':'#FF8C8C'); g.addColorStop(.5,od?'#F59E0B':'#FF4757'); g.addColorStop(1,od?'#B45309':'#AA1122');
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(x-r*.28,y-r*.28,r*.25,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.fill();
    ctx.fillStyle=od?'#FFE600':'rgba(255,255,255,0.7)';
    ctx.font=`bold ${Math.floor(10*s)}px sans-serif`; ctx.textAlign='center';
    ctx.fillText(od?'⚡':'KLICK', x, y+r+14*s);
    ctx.restore();
  }

  // ── Missions Panel ──────────────────────────────────────────────────────
  function _drawMissionsPanel(ctx, canvas, info) {
    const s=canvas.width/836, ms=info.missions||[];
    if (!ms.length) return;
    const px=12*s, py=canvas.height*.12, pw=160*s, ph=100*s;
    ctx.save();
    ctx.fillStyle='rgba(13,15,26,0.80)'; ctx.beginPath(); ctx.roundRect(px,py,pw,ph,8*s); ctx.fill();
    ctx.strokeStyle='rgba(0,198,255,0.3)'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font=`bold ${Math.floor(10*s)}px sans-serif`;
    ctx.textAlign='left'; ctx.fillText('MISSIONEN',px+8*s,py+14*s);
    ms.forEach((m,i)=>{
      const my=py+28*s+i*24*s;
      ctx.font=`${Math.floor(13*s)}px sans-serif`;
      ctx.fillStyle=m.completed?'#FFE600':'rgba(255,255,255,0.2)';
      if(m.completed){ctx.shadowColor='#FFE600';ctx.shadowBlur=8;}else ctx.shadowBlur=0;
      ctx.fillText('★',px+8*s,my+10*s); ctx.shadowBlur=0;
      ctx.font=`${Math.floor(11*s)}px sans-serif`;
      ctx.fillStyle=m.completed?'#FFF':'rgba(255,255,255,0.4)';
      ctx.fillText(m.label,px+24*s,my+10*s);
    });
    ctx.restore();
  }

  // ── Level + Prestige Badge ───────────────────────────────────────────────
  function _drawLevelBadge(ctx, canvas, level, prestigeLevel) {
    const s=canvas.width/836, cx=canvas.width/2, p=prestigeLevel>0;
    const label = p ? `✦ LVL ${level}  P${prestigeLevel}` : `LEVEL ${level}`;
    ctx.save();
    ctx.font=`bold ${Math.floor(13*s)}px sans-serif`;
    const tw=ctx.measureText(label).width, pw=tw+20*s, ph=22*s, bx=cx-pw/2, by=6*s;
    ctx.fillStyle=p?'rgba(245,158,11,0.2)':'rgba(0,198,255,0.15)';
    ctx.strokeStyle=p?'rgba(245,158,11,0.7)':'rgba(0,198,255,0.5)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect(bx,by,pw,ph,ph/2); ctx.fill(); ctx.stroke();
    ctx.fillStyle=p?'#F59E0B':'#00C6FF'; ctx.shadowColor=p?'#F59E0B':'#00C6FF'; ctx.shadowBlur=8;
    ctx.textAlign='center'; ctx.fillText(label,cx,by+ph*.72);
    ctx.restore();
  }

  // ── Streak Badge ─────────────────────────────────────────────────────────
  function _drawStreakBadge(ctx, canvas, streak) {
    if (streak < 2) return;
    const s=canvas.width/836;
    ctx.save();
    ctx.fillStyle='#F97316'; ctx.shadowColor='#F97316'; ctx.shadowBlur=10;
    ctx.font=`bold ${Math.floor(12*s)}px sans-serif`; ctx.textAlign='right';
    ctx.fillText(`🔥 ${streak} Tage`, canvas.width-12*s, 56*s);
    ctx.restore();
  }

  function _drawDifficultyBadge(ctx, canvas, label) {
    if (!label) return;
    const s=canvas.width/836;
    ctx.save();
    ctx.fillStyle='rgba(239,68,68,0.8)'; ctx.font=`bold ${Math.floor(10*s)}px sans-serif`;
    ctx.textAlign='center'; ctx.fillText(label, canvas.width/2, 32*s);
    ctx.restore();
  }

  // ── Milestone Toast ──────────────────────────────────────────────────────
  // !! FIX: wird nur noch im RESULT-State gerufen (siehe draw()) !!
  function _drawMilestoneToast(ctx, canvas, milestone) {
    if (!milestone) return;
    const s=canvas.width/836, cx=canvas.width/2;
    const tw=280*s, th=56*s, tx=cx-tw/2, ty=canvas.height-80*s;
    ctx.save();
    ctx.fillStyle='rgba(17,24,39,0.96)'; ctx.shadowColor='#F59E0B'; ctx.shadowBlur=20;
    ctx.beginPath(); ctx.roundRect(tx,ty,tw,th,12*s); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='#F59E0B'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#F59E0B'; ctx.font=`bold ${Math.floor(14*s)}px sans-serif`;
    ctx.textAlign='center'; ctx.fillText(milestone.label, cx, ty+22*s);
    ctx.fillStyle='rgba(255,255,255,0.6)'; ctx.font=`${Math.floor(11*s)}px sans-serif`;
    ctx.fillText(`+${milestone.stars} ★ freigeschaltet`, cx, ty+40*s);
    ctx.restore();
  }

  // ── IDLE ────────────────────────────────────────────────────────────────
  function _drawIdle(ctx, canvas, info) {
    const cx=canvas.width/2, s=canvas.width/836;
    _drawMissionsPanel(ctx, canvas, info);
    _drawLevelBadge(ctx, canvas, info.level, info.prestigeLevel||0);
    ctx.save();
    ctx.fillStyle='#00C6FF'; ctx.font=`bold ${Math.floor(48*s)}px sans-serif`;
    ctx.textAlign='center'; ctx.shadowColor='#00C6FF'; ctx.shadowBlur=30;
    ctx.fillText('BUBBLE REACTOR', cx, canvas.height*.50);
    ctx.shadowBlur=0; ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.font=`${Math.floor(17*s)}px sans-serif`;
    ctx.fillText('Bewege die Maus — klicke zum Zünden', cx, canvas.height*.56);
    ctx.fillStyle='#FFE600'; ctx.shadowColor='#FFE600'; ctx.shadowBlur=10;
    ctx.font=`bold ${Math.floor(14*s)}px sans-serif`;
    ctx.fillText(`★ ${info.totalStars}`, cx, canvas.height*.61);
    ctx.shadowBlur=0;
    if ((info.currentStreak||0) >= 2) {
      ctx.fillStyle='#F97316'; ctx.font=`${Math.floor(12*s)}px sans-serif`;
      ctx.fillText(`🔥 ${info.currentStreak} Tage Streak`, cx, canvas.height*.65);
    }
    const pulse=0.8+Math.sin(Date.now()/400)*.2;
    ctx.globalAlpha=pulse; ctx.fillStyle='#39FF14';
    ctx.font=`bold ${Math.floor(16*s)}px sans-serif`;
    ctx.fillText('▼  KLICK ZUM STARTEN  ▼', cx, canvas.height*.70);
    ctx.restore();
  }

  // ── HUD ─────────────────────────────────────────────────────────────────
  function _drawHUD(ctx, canvas, info) {
    const s=canvas.width/836;
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font=`bold ${Math.floor(22*s)}px sans-serif`;
    ctx.textAlign='right';
    ctx.fillText(`${info.totalScore.toLocaleString()} pts`, canvas.width-16*s, 34*s);
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font=`bold ${Math.floor(11*s)}px sans-serif`;
    ctx.textAlign='left'; ctx.fillText('TAPS', 16*s, 20*s);
    for (let i=0; i<info.tapsMax; i++) {
      const filled=i<(info.tapsMax-info.tapsUsed), cx2=(22+i*26)*s, cy2=34*s, r=9*s;
      ctx.beginPath(); ctx.arc(cx2,cy2,r,0,Math.PI*2);
      if(filled){ctx.fillStyle='#00C6FF';ctx.shadowColor='#00C6FF';ctx.shadowBlur=10;ctx.fill();}
      else{ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1.5;ctx.stroke();}
      ctx.shadowBlur=0;
    }
    if (info.overdrivePending) {
      ctx.fillStyle='#FFE600'; ctx.shadowColor='#FFE600'; ctx.shadowBlur=12;
      ctx.font=`bold ${Math.floor(11*s)}px sans-serif`; ctx.textAlign='left';
      ctx.fillText('⚡ OVERDRIVE BEREIT', 16*s, 52*s); ctx.shadowBlur=0;
    }
    _drawLevelBadge(ctx, canvas, info.level, info.prestigeLevel||0);
    _drawDifficultyBadge(ctx, canvas, info.adaptiveDiffLabel);
    if (info.chainLength > 0) {
      ctx.textAlign='center'; ctx.font=`bold ${Math.floor(30*s)}px sans-serif`;
      ctx.fillStyle='#FFE600'; ctx.shadowColor='#FFE600'; ctx.shadowBlur=20;
      ctx.fillText(`×${info.multiplier}  ${info.chainLength} CHAIN`, canvas.width/2, 38*s);
      ctx.shadowBlur=0;
    }
    _drawMissionsPanel(ctx, canvas, info);
    _drawStreakBadge(ctx, canvas, info.currentStreak||0);
    ctx.restore();
  }

  // ── Result Screen ───────────────────────────────────────────────────────
  function _drawResult(ctx, canvas, result, info) {
    if (!result) return;
    const cx=canvas.width/2, cy=canvas.height/2, s=canvas.width/836;
    _clearButtons();
    ctx.save();
    ctx.fillStyle='rgba(13,15,26,0.92)';
    ctx.beginPath(); ctx.roundRect(cx-220*s, cy-185*s, 440*s, 440*s, 16*s); ctx.fill();
    ctx.strokeStyle='#00C6FF'; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font=`${Math.floor(12*s)}px sans-serif`;
    ctx.textAlign='center';
    ctx.fillText(`BOARD ${info.boardIndex+1}  ·  LEVEL ${info.level}${info.isWeeklyBoard?' 🏆':''}`, cx, cy-162*s);
    ctx.fillStyle='#FFF'; ctx.font=`bold ${Math.floor(38*s)}px sans-serif`;
    ctx.shadowColor='#00C6FF'; ctx.shadowBlur=15;
    ctx.fillText(`${info.totalScore.toLocaleString()} pts`, cx, cy-120*s); ctx.shadowBlur=0;
    const bc=Math.max(0,...(info.tapsResults||[]).map(r=>r.chainLength));
    ctx.fillStyle='#FFE600'; ctx.font=`${Math.floor(15*s)}px sans-serif`;
    ctx.fillText(`Beste Chain: ${bc}`, cx, cy-88*s);
    ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.font=`bold ${Math.floor(11*s)}px sans-serif`;
    ctx.fillText('MISSIONEN', cx, cy-60*s);
    const ms=info.missions||[], se=ms.filter(m=>m.completed).length;
    ms.forEach((m,i)=>{
      const my=cy-38*s+i*32*s;
      ctx.font=`${Math.floor(18*s)}px sans-serif`;
      if(m.completed){ctx.fillStyle='#FFE600';ctx.shadowColor='#FFE600';ctx.shadowBlur=10;}
      else{ctx.fillStyle='rgba(255,255,255,0.18)';ctx.shadowBlur=0;}
      ctx.fillText('★', cx-100*s, my+6*s); ctx.shadowBlur=0;
      ctx.textAlign='left'; ctx.font=`${Math.floor(14*s)}px sans-serif`;
      ctx.fillStyle=m.completed?'#FFF':'rgba(255,255,255,0.35)';
      ctx.fillText(m.label, cx-78*s, my+6*s); ctx.textAlign='center';
    });
    ctx.font=`${Math.floor(22*s)}px sans-serif`;
    for(let i=0;i<3;i++){
      ctx.fillStyle=i<se?'#FFE600':'rgba(255,255,255,0.15)';
      if(i<se){ctx.shadowColor='#FFE600';ctx.shadowBlur=12;}else ctx.shadowBlur=0;
      ctx.fillText('★', cx+(i-1)*30*s, cy+68*s);
    }
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.font=`${Math.floor(12*s)}px sans-serif`;
    ctx.fillText(`Gesamt ★ ${info.totalStars}`, cx, cy+88*s);
    const hs=Storage.get(Storage.KEYS.HIGH_SCORE)||0;
    ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font=`${Math.floor(11*s)}px sans-serif`;
    ctx.fillText(`Rekord: ${hs.toLocaleString()} pts`, cx, cy+104*s);
    ctx.restore();
    const gap=44*s; let btnY=cy+116*s;
    _drawButton(ctx,s,cx,btnY,'next','▶  Nächstes Board','#16A34A','#22C55E'); btnY+=gap;
    if(!info.retryUsed){_drawButton(ctx,s,cx,btnY,'retry','▶  Nochmal (Werbung)','#B45309','#F59E0B');btnY+=gap;}
    _drawButton(ctx,s,cx,btnY,'shop','🛒  Upgrade Shop','#6D28D9','#8B5CF6'); btnY+=gap;
    if(!info.dailyPlayedToday){_drawButton(ctx,s,cx,btnY,'daily','📅  Daily Board','#4338CA','#6366F1');btnY+=gap;}
    if(!info.weeklyPlayedThisWeek){_drawButton(ctx,s,cx,btnY,'weekly',`${info.weeklyIcon||'🏆'}  ${info.weeklyLabel||'Weekly'}`, '#065F46','#10B981');}
  }

  // ── Shop Screen ─────────────────────────────────────────────────────────
  // !! FIX: rowH von 76*s auf 46*s reduziert, Back-Button ans untere Ende gepinnt !!
  function _drawShop(ctx, canvas, info) {
    const cx=canvas.width/2, s=canvas.width/836;
    const upgrades=info.upgradeStatus||[];
    _clearButtons();

    // Vollbild-Overlay
    ctx.save();
    ctx.fillStyle='rgba(5,7,15,0.97)'; ctx.fillRect(0,0,canvas.width,canvas.height);

    // Prestige-Banner (wenn verfügbar)
    const hasPrestige = info.prestigeAvailable;
    if (hasPrestige) {
      ctx.fillStyle='rgba(245,158,11,0.15)'; ctx.strokeStyle='rgba(245,158,11,0.5)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.roundRect(16*s, 8*s, canvas.width-32*s, 30*s, 6*s); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#F59E0B'; ctx.shadowColor='#F59E0B'; ctx.shadowBlur=10;
      ctx.font=`bold ${Math.floor(11*s)}px sans-serif`; ctx.textAlign='center';
      ctx.fillText('✦  ALLE UPGRADES MAXED — PRESTIGE VERFÜGBAR!  ✦', cx-60*s, 28*s);
      ctx.restore(); ctx.save();
      _drawButton(ctx, s, canvas.width-90*s, 10*s, 'prestige', '✦ PRESTIGE', '#92400E','#F59E0B', 100);
      ctx.save();
    }

    // Header
    const headerY = hasPrestige ? 50*s : 10*s;
    ctx.fillStyle='#8B5CF6'; ctx.font=`bold ${Math.floor(18*s)}px sans-serif`;
    ctx.textAlign='center'; ctx.shadowColor='#8B5CF6'; ctx.shadowBlur=14;
    ctx.fillText('✦  UPGRADE SHOP  ✦', cx, headerY+22*s); ctx.shadowBlur=0;
    ctx.fillStyle='#FFE600'; ctx.shadowColor='#FFE600'; ctx.shadowBlur=8;
    ctx.font=`bold ${Math.floor(13*s)}px sans-serif`;
    ctx.fillText(`★ ${info.totalStars}  ·  Prestige ${info.prestigeLevel||0}`, cx, headerY+40*s); ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(139,92,246,0.3)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(16*s, headerY+48*s); ctx.lineTo(canvas.width-16*s, headerY+48*s); ctx.stroke();

    // !! FIX: rowH = 46*s statt 76*s — passt jetzt vollständig in den Canvas !!
    const rowH    = 46*s;
    const colW    = (canvas.width - 24*s) / 2;
    const startY  = headerY + 54*s;
    // Back-Button am festen unteren Ende, nicht nach Rows berechnet
    const backBtnY = canvas.height - 46*s;

    upgrades.forEach((upg, i) => {
      const col  = i % 2;
      const row  = Math.floor(i / 2);
      const cellX = 12*s + col * colW;
      const cellY = startY + row * rowH;

      // Zellen-Hintergrund
      ctx.save();
      ctx.fillStyle  = upg.maxed ? 'rgba(110,231,183,0.06)' : 'rgba(255,255,255,0.04)';
      ctx.strokeStyle = upg.maxed ? 'rgba(110,231,183,0.2)' : 'rgba(139,92,246,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(cellX+2*s, cellY+2*s, colW-8*s, rowH-5*s, 6*s); ctx.fill(); ctx.stroke();

      // Icon
      ctx.font=`${Math.floor(16*s)}px sans-serif`; ctx.textAlign='left'; ctx.fillStyle='#FFF';
      ctx.fillText(upg.icon, cellX+8*s, cellY+20*s);

      // Label
      ctx.font=`bold ${Math.floor(10.5*s)}px sans-serif`;
      ctx.fillStyle=upg.maxed?'#6EE7B7':'#FFF';
      ctx.fillText(upg.label, cellX+30*s, cellY+16*s);

      // Beschreibung
      ctx.font=`${Math.floor(9*s)}px sans-serif`; ctx.fillStyle='rgba(255,255,255,0.4)';
      ctx.fillText(upg.desc, cellX+30*s, cellY+28*s);

      // Stufen-Dots
      for (let d=0; d<upg.maxLevel; d++) {
        ctx.beginPath(); ctx.arc(cellX+30*s+d*10*s, cellY+40*s, 3*s, 0, Math.PI*2);
        ctx.fillStyle = d<upg.level ? '#8B5CF6' : 'rgba(255,255,255,0.15)'; ctx.fill();
      }

      // Kauf-Button
      const bw=60*s, bh=20*s, bx=cellX+colW-68*s, by2=cellY+rowH-26*s;
      if (upg.maxed) {
        ctx.fillStyle='rgba(110,231,183,0.15)'; ctx.beginPath(); ctx.roundRect(bx,by2,bw,bh,4*s); ctx.fill();
        ctx.fillStyle='#6EE7B7'; ctx.font=`bold ${Math.floor(9*s)}px sans-serif`; ctx.textAlign='center';
        ctx.fillText('MAX ✓', bx+bw/2, by2+bh*.72);
      } else {
        ctx.fillStyle=upg.canBuy?'#7C3AED':'rgba(255,255,255,0.07)';
        ctx.shadowColor=upg.canBuy?'#8B5CF6':'transparent'; ctx.shadowBlur=upg.canBuy?8:0;
        ctx.beginPath(); ctx.roundRect(bx,by2,bw,bh,4*s); ctx.fill(); ctx.shadowBlur=0;
        ctx.fillStyle=upg.canBuy?'#FFF':'rgba(255,255,255,0.25)';
        ctx.font=`bold ${Math.floor(9*s)}px sans-serif`; ctx.textAlign='center';
        ctx.fillText(`★ ${upg.cost}`, bx+bw/2, by2+bh*.72);
        if (upg.canBuy) _registerButton('buy_'+upg.id, bx, by2, bw, bh);
      }
      ctx.restore();
    });

    ctx.restore();

    // !! FIX: Back-Button immer am unteren Rand, unabhängig von Inhaltshöhe !!
    _drawButton(ctx, s, cx, backBtnY, 'shop_back', '← Weiter spielen', '#374151','#6B7280', 200);
  }

  // ── Haupt-Render ────────────────────────────────────────────────────────
  function draw(ctx, canvas, state, bubbles, lastResult, info) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    _applyShake(ctx);
    _drawBackground(ctx, canvas);
    _updateTrail(info.launcher||{}, info.trailEnabled);

    if (state !== 'SHOP') {
      bubbles.forEach(b => _drawBubble(ctx, b));
      if (typeof Particles !== 'undefined') Particles.draw(ctx);
    }

    switch (state) {
      case 'IDLE':      _drawIdle(ctx, canvas, info);    _drawLauncher(ctx, canvas, info); break;
      case 'PLAYING':   _drawHUD(ctx, canvas, info);     _drawLauncher(ctx, canvas, info); break;
      case 'EXPLODING': _drawHUD(ctx, canvas, info);     break;
      case 'RESULT':    _drawHUD(ctx, canvas, info);     _drawResult(ctx, canvas, lastResult, info); break;
      case 'SHOP':      _drawShop(ctx, canvas, info);    break;
    }

    ctx.restore();
    _drawFlash(ctx, canvas);

    // !! FIX: Toast NUR im RESULT-State zeichnen !!
    if (state === 'RESULT') {
      _drawMilestoneToast(ctx, canvas, info.pendingMilestone);
    }
  }

  // ── Color Helpers ────────────────────────────────────────────────────────
  function lightenColor(hex, a) { return _shiftColor(hex, a); }
  function darkenColor(hex, a)  { return _shiftColor(hex, -a); }
  function _shiftColor(hex, a) {
    const n = parseInt(hex.replace('#',''), 16);
    return `rgb(${Math.min(255,Math.max(0,(n>>16)+a))},${Math.min(255,Math.max(0,((n>>8)&0xff)+a))},${Math.min(255,Math.max(0,(n&0xff)+a))})`;
  }

  return { draw, triggerShake, triggerFlash, getHitButton };
})();