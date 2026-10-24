// 캔버스 그리기. 상태는 읽기만 한다.
import { CORAL, GY, H, INK, PALETTE, R, SLOT, SPRITE, SPRITE_Y, TOTAL_BALLS, W, CHICK_X, DRAW_SEQ, slotX } from "./config";
import { balloonX, type Game } from "./engine";
import type { Balloon, Theme } from "./types";
import { ballColor, rnd, shade } from "./util";

export interface Sprites {
  archer: HTMLImageElement;
  arrow: HTMLImageElement;
}

const ready = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

export function render(ctx: CanvasRenderingContext2D, g: Game, sprites: Sprites, now: number) {
  const cv = ctx.canvas;
  const pal = PALETTE[g.theme];
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  if (g.shake > 0) ctx.translate(rnd(-1, 1) * g.shake * 16, rnd(-1, 1) * g.shake * 16);

  drawSky(ctx, g, g.theme, now);
  g.balloons.forEach((b) => drawBalloon(ctx, g, b));
  drawGround(ctx, pal);
  drawSlots(ctx);
  drawArcher(ctx, g, sprites.archer, now);
  drawChick(ctx, g, now);
  if (g.archer.phase === "aiming") drawAimGuide(ctx, g);
  drawArrow(ctx, g, sprites.arrow, pal.trail);
  g.balls.forEach((b) => drawBall(ctx, b.x, b.y, b.n, b.ang, b.s));
  drawRockets(ctx, g);
  drawParticles(ctx, g);
  drawTexts(ctx, g);
  drawWindGauge(ctx, g.wind.speed, g.theme);
  if (g.banner) drawBanner(ctx, g.banner, now);
  else if (g.done) outlinedText(ctx, "추첨 완료!", 470, 60, 40, "#fff");
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(255,250,220,${g.flash * 0.75})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }
}

/** 역대 1·2등 배너: 회전하는 금빛 빛줄기 + 커졌다 작아지는 금색 글씨 */
function drawBanner(ctx: CanvasRenderingContext2D, banner: NonNullable<Game["banner"]>, now: number) {
  const age = banner.maxLife - banner.life;
  const alpha = Math.min(1, banner.life * 1.5, age * 4);
  const cx = 470;
  const cy = 150;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.save();
  ctx.rotate(now / 2400);
  for (let i = 0; i < 14; i++) {
    ctx.rotate((Math.PI * 2) / 14);
    const grad = ctx.createLinearGradient(0, 0, 260, 0);
    grad.addColorStop(0, "rgba(255,215,0,.55)");
    grad.addColorStop(1, "rgba(255,215,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(260, -18);
    ctx.lineTo(260, 18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const pop = age < 0.4 ? 0.3 + (age / 0.4) * 0.85 : 1.15 - Math.min(0.15, (age - 0.4) * 0.5);
  const s = pop * (1 + Math.sin(now / 160) * 0.03);
  ctx.scale(s, s);
  ctx.font = '64px "Black Han Sans",sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 12;
  ctx.strokeStyle = INK;
  ctx.strokeText(banner.text, 0, 0);
  const gold = ctx.createLinearGradient(0, -32, 0, 32);
  gold.addColorStop(0, "#fff7c2");
  gold.addColorStop(0.45, "#ffd700");
  gold.addColorStop(1, "#e09a00");
  ctx.fillStyle = gold;
  ctx.fillText(banner.text, 0, 0);
  ctx.restore();
}

// ---------- 배경 ----------
function drawSky(ctx: CanvasRenderingContext2D, g: Game, theme: Theme, now: number) {
  const pal = PALETTE[theme];
  const sky = ctx.createLinearGradient(0, 0, 0, GY);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, W + 40, GY + 20);

  if (theme === "night") {
    for (const s of g.stars) {
      ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(now / 900 + s.ph));
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 달: 둥근 원 + 분화구
    ctx.save();
    ctx.shadowColor = "rgba(255,244,200,.7)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#fff4c8";
    ctx.beginPath();
    ctx.arc(70, 64, 30, 0, 7);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(220,205,150,.55)";
    for (const [x, y, r] of [[60, 56, 6], [80, 72, 4.5], [74, 50, 3]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 7);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "rgba(255,232,120,.9)";
    ctx.beginPath();
    ctx.arc(70, 64, 34, 0, 7);
    ctx.fill();
  }

  ctx.fillStyle = pal.cloud;
  for (const c of g.clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 46 * c.s, 18 * c.s, 0, 0, 7);
    ctx.ellipse(c.x + 28 * c.s, c.y - 12 * c.s, 30 * c.s, 20 * c.s, 0, 0, 7);
    ctx.ellipse(c.x - 26 * c.s, c.y - 6 * c.s, 24 * c.s, 14 * c.s, 0, 0, 7);
    ctx.fill();
  }

  // 먼 언덕
  ctx.fillStyle = pal.hills;
  ctx.beginPath();
  ctx.moveTo(-20, GY);
  ctx.quadraticCurveTo(200, GY - 90, 420, GY - 30);
  ctx.quadraticCurveTo(620, GY - 110, W + 20, GY - 40);
  ctx.lineTo(W + 20, GY);
  ctx.fill();
}

function drawGround(ctx: CanvasRenderingContext2D, pal: (typeof PALETTE)[Theme]) {
  ctx.fillStyle = pal.ground;
  ctx.fillRect(-20, GY, W + 40, H - GY + 20);
  ctx.fillStyle = pal.grass;
  for (let x = 0; x < W; x += 26) ctx.fillRect(x, GY + 18 + ((x / 26) % 2) * 14, 14, 4);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-20, GY);
  ctx.lineTo(W + 20, GY);
  ctx.stroke();
}

/** 공이 멈추는 나무 받침 */
function drawSlots(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#c98a4b";
  roundRect(ctx, SLOT.plateX, GY + 8, SLOT.plateW, 40, 10);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.font = '15px "Jua",sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < TOTAL_BALLS; i++) {
    const x = slotX(i);
    ctx.fillStyle = "#8d5a2b";
    ctx.beginPath();
    ctx.ellipse(x, GY + 20, 20, 6, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#fff4e0";
    ctx.fillText(i < TOTAL_BALLS - 1 ? String(i + 1) : "보너스", x, GY + 38);
  }
  ctx.fillStyle = INK;
  ctx.font = '26px "Jua",sans-serif';
  ctx.fillText("+", SLOT.plusX, GY - 20);
}

/** 오른쪽 위 풍향·풍속 표시 */
function drawWindGauge(ctx: CanvasRenderingContext2D, wind: number, theme: Theme) {
  const x = W - 142;
  const y = 12;
  ctx.save();
  ctx.fillStyle = theme === "night" ? "rgba(20,30,60,.7)" : "rgba(255,255,255,.85)";
  roundRect(ctx, x, y, 130, 30, 8);
  ctx.fill();
  const fg = theme === "night" ? "#eef2ff" : INK;
  ctx.fillStyle = fg;
  ctx.font = '14px "Jua",sans-serif';
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("바람", x + 10, y + 16);
  ctx.textAlign = "right";
  ctx.fillText(`${Math.abs(wind).toFixed(1)}m/s`, x + 122, y + 16);
  // 화살표: 길이는 풍속, 방향은 바람 방향
  const cx = x + 66;
  const len = 6 + Math.min(1, Math.abs(wind) / 4) * 16;
  const dir = Math.sign(wind) || 1;
  ctx.strokeStyle = fg;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - (len / 2) * dir, y + 15);
  ctx.lineTo(cx + (len / 2) * dir, y + 15);
  ctx.moveTo(cx + (len / 2) * dir, y + 15);
  ctx.lineTo(cx + (len / 2 - 6) * dir, y + 10);
  ctx.moveTo(cx + (len / 2) * dir, y + 15);
  ctx.lineTo(cx + (len / 2 - 6) * dir, y + 20);
  ctx.stroke();
  ctx.restore();
}

// ---------- 등장인물 ----------
function archerFrame(g: Game, now: number) {
  const a = g.archer;
  switch (a.phase) {
    case "drawing": {
      let t = a.t;
      for (const [f, d] of DRAW_SEQ) {
        if (t < d) return f;
        t -= d;
      }
      return 3;
    }
    case "aiming":
      return a.power < 0.2 ? 1 : a.power < 0.55 ? 2 : 3;
    case "release":
      return 5;
    case "after":
      return a.t < 0.4 ? 6 : a.t < 0.75 ? 4 : 7;
    default:
      return now % 4200 < 260 ? 7 : 0; // 가끔 활을 내렸다 올림
  }
}

function drawArcher(ctx: CanvasRenderingContext2D, g: Game, img: HTMLImageElement, now: number) {
  const a = g.archer;
  const f = archerFrame(g, now);
  // 끝까지 당겼을 때 손이 미세하게 떨림
  const jx = f === 2 || f === 3 ? Math.sin(now / 23) * 0.9 : 0;
  const jy = f === 2 || f === 3 ? Math.cos(now / 29) * 0.7 : 0;
  const breathe = a.phase === "idle" ? Math.sin(now / 520) : 0;
  const footX = SPRITE.x + SPRITE.footX;

  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath();
  ctx.ellipse(footX, GY + 2, 58, 9, 0, 0, 7);
  ctx.fill();
  if (ready(img)) {
    const sq = 1 + breathe * 0.006;
    ctx.save();
    ctx.imageSmoothingQuality = "high";
    ctx.translate(footX - a.recoil * 6 + jx, GY);
    ctx.scale(1 / sq, sq);
    ctx.drawImage(img, f * SPRITE.frameW, 0, SPRITE.frameW, SPRITE.frameH, -SPRITE.footX, -SPRITE.frameH + jy, SPRITE.frameW, SPRITE.frameH);
    ctx.restore();
  }
  if (a.talkT > 0 && a.talk) bubble(ctx, footX + 6, SPRITE_Y + 10, a.talk, a.talkT);
}

function drawChick(ctx: CanvasRenderingContext2D, g: Game, now: number) {
  const c = g.chick;
  const x = CHICK_X;
  const y = GY - 18 + c.jump;
  const sq = c.jump < 0 ? 1 : 1 + Math.sin(now / 250) * 0.03;
  ctx.fillStyle = "rgba(0,0,0,.15)";
  ctx.beginPath();
  ctx.ellipse(x, GY + 2, 18 * (1 + c.jump / 300), 4, 0, 0, 7);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / sq, sq);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.fillStyle = "#ffd23f"; // 몸
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 17, 0, 0, 7);
  ctx.fill();
  ctx.stroke();
  const flap = c.jump < 0 ? Math.sin(now / 40) * 0.8 : 0; // 날개
  ctx.save();
  ctx.translate(-14, 2);
  ctx.rotate(-0.4 - flap);
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 5, 0, 0, 7);
  ctx.fillStyle = "#f6bd16";
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = INK; // 눈
  ctx.beginPath();
  ctx.arc(6, -5, 2.6, 0, 7);
  ctx.fill();
  ctx.fillStyle = "#ff8c42"; // 부리
  ctx.beginPath();
  ctx.moveTo(15, -2);
  ctx.lineTo(23, 1);
  ctx.lineTo(15, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = CORAL; // 볏
  ctx.beginPath();
  ctx.moveTo(-2, -16);
  ctx.lineTo(1, -24);
  ctx.lineTo(4, -16);
  ctx.fill();
  ctx.restore();
  if (c.talkT > 0 && c.talk) bubble(ctx, x, y - 22, c.talk, c.talkT);
}

// ---------- 물체 ----------
function drawBalloon(ctx: CanvasRenderingContext2D, g: Game, b: Balloon) {
  const sx = balloonX(b);
  ctx.strokeStyle = "rgba(31,43,69,.5)"; // 끈
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx, b.y + b.r * 1.15);
  ctx.bezierCurveTo(sx - 8, b.y + b.r + 20, sx + 8, b.y + b.r + 36, sx - 2, b.y + b.r + 54);
  ctx.stroke();

  const grad = ctx.createRadialGradient(sx - b.r * 0.35, b.y - b.r * 0.45, 3, sx, b.y, b.r * 1.2);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(0.3, b.c);
  grad.addColorStop(1, shade(b.c));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(sx, b.y, b.r, b.r * 1.18, 0, 0, 7);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = b.c; // 매듭
  ctx.beginPath();
  ctx.moveTo(sx - 5, b.y + b.r * 1.2);
  ctx.lineTo(sx + 5, b.y + b.r * 1.2);
  ctx.lineTo(sx, b.y + b.r * 1.08);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.font = '22px "Jua",sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("?", sx, b.y + 2);

  if (g.archer.target === b || g.arrow?.target === b) {
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sx, b.y, b.r + 12, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** 직접 조준 중: 궤적 미리보기 점 + 당긴 힘 게이지 */
function drawAimGuide(ctx: CanvasRenderingContext2D, g: Game) {
  const pts = g.aimPreview();
  ctx.save();
  pts.forEach((p, i) => {
    ctx.globalAlpha = 0.9 - (i / pts.length) * 0.7;
    ctx.fillStyle = g.theme === "night" ? "#fff6c8" : "#fff";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.2 - i * 0.25, 0, 7);
    ctx.fill();
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  const x = SPRITE.x + 40;
  const y = SPRITE_Y - 6;
  ctx.fillStyle = "rgba(255,255,255,.85)";
  roundRect(ctx, x, y, 110, 10, 5);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = g.archer.power >= 1 ? CORAL : "#ffd23f";
  roundRect(ctx, x + 2, y + 2, 106 * g.archer.power, 6, 3);
  ctx.fill();
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, g: Game, img: HTMLImageElement, trailColor: string) {
  const ar = g.arrow;
  if (!ar) return;
  ctx.strokeStyle = trailColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ar.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();

  ctx.save();
  ctx.translate(ar.x, ar.y);
  ctx.rotate(ar.a);
  if (ready(img)) {
    ctx.drawImage(img, -img.width, -img.height / 2);
  } else {
    // 이미지가 아직 없을 때 쓰는 단순한 화살
    ctx.strokeStyle = "#6b3b16";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-64, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.fillStyle = "#c7ccd6";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-4, -6);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, ang: number, s: number) {
  const color = ballColor(n);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath();
  ctx.ellipse(0, R + 1, R * 0.85, 4, 0, 0, 7);
  ctx.fill();
  const grad = ctx.createRadialGradient(-7, -8, 2, 0, 0, R);
  grad.addColorStop(0, "#fff");
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, shade(color));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, 7);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(31,43,69,.55)";
  ctx.stroke();
  ctx.rotate(ang);
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.62, 0, 7);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = '20px "Jua",sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), 0, 1.5);
  ctx.restore();
}

// ---------- 효과 ----------
function drawRockets(ctx: CanvasRenderingContext2D, g: Game) {
  for (const r of g.rockets) {
    if (r.delay > 0) continue;
    ctx.fillStyle = "#fff6c8";
    ctx.beginPath();
    ctx.arc(r.x, r.y, 2.5, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,240,180,.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x - r.vx * 0.05, r.y - r.vy * 0.05);
    ctx.stroke();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, g: Game) {
  for (const p of g.parts) {
    ctx.save();
    if (p.kind === "spark") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.min(1, (p.life / p.maxLife) * 1.6);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.w, 0, 7);
      ctx.fill();
    } else {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2);
    }
    ctx.restore();
  }
}

function drawTexts(ctx: CanvasRenderingContext2D, g: Game) {
  for (const t of g.texts) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, t.life * 2);
    outlinedText(ctx, t.t, t.x, t.y, 34, "#ffd23f");
    ctx.restore();
  }
}

// ---------- 도우미 ----------
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string) {
  ctx.save();
  ctx.font = `${size}px "Black Han Sans",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = size / 5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** 말풍선 */
function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha * 3);
  ctx.font = '18px "Jua",sans-serif';
  const w = ctx.measureText(text).width + 22;
  roundRect(ctx, x - w / 2, y - 34, w, 30, 12);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 5);
  ctx.lineTo(x, y + 6);
  ctx.lineTo(x + 6, y - 5);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - 19);
  ctx.restore();
}
