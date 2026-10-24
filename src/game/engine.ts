// 게임 상태와 한 프레임 업데이트. 그리기는 render.ts, 화면(DOM)은 React 컴포넌트가 맡는다.
import type { SoundSystem } from "./audio";
import {
  AIM,
  ARCHER_LINES,
  ARROW,
  BALLOON,
  BALLOON_COLORS,
  BOW_TIP,
  CHICK_CHEERS,
  DRAW_TIME,
  GY,
  H,
  MAIN_BALLS,
  R,
  SHOULDER,
  TOTAL_BALLS,
  W,
  WIND,
  slotX,
} from "./config";
import type { Archer, Arrow, Ball, Balloon, Chick, Cloud, FloatText, Particle, Point, Rocket, Snapshot, Star, Theme } from "./types";
import { clamp, cryptoInt, pick, rnd } from "./util";
import { Wind, makeClouds, makeStars, moveClouds } from "./weather";

const GOLD = ["#ffd700", "#ffe680", "#fff3b0", "#ffb800", "#ffffff"];

export interface GameEvents {
  /** 버튼·번호판에 보이는 상태가 바뀌었을 때 */
  onChange(snap: Snapshot): void;
  /** 7개를 모두 뽑고 공이 전부 자리에 멈췄을 때 */
  onFinish(main: number[], bonus: number): void;
}

/** 직접 조준 중인 포인터 */
interface Press {
  start: Point;
  at: number;
  aiming: boolean;
}

/** 풍선은 좌우로 살짝 흔들리며 그려진다. 맞힘 판정도 그려진 위치 기준 */
export const balloonX = (b: Balloon) => b.x + Math.sin(b.ph) * 6;

function newBalloon(y?: number): Balloon {
  return {
    x: rnd(BALLOON.minX, BALLOON.maxX),
    y: y ?? rnd(GY + 20, GY + 80),
    r: rnd(26, 32),
    c: pick(BALLOON_COLORS),
    vy: rnd(-38, -22),
    ph: rnd(0, 6.28),
    wob: rnd(0.8, 1.6),
  };
}

export class Game {
  theme: Theme = "day";
  readonly reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  readonly wind = new Wind();
  readonly clouds: Cloud[] = makeClouds();
  readonly stars: Star[] = makeStars();

  pool: number[] = [];
  drawn: number[] = [];
  balls: Ball[] = [];
  balloons: Balloon[] = [];
  arrow: Arrow | null = null;
  parts: Particle[] = [];
  rockets: Rocket[] = [];
  texts: FloatText[] = [];
  archer!: Archer;
  chick!: Chick;
  done = false;
  auto = false;
  shake = 0;
  /** 게임 시작 후 흐른 시간(초) */
  time = 0;
  /** 역대 1·2등 축하 배너와 화면 번쩍임 */
  banner: { text: string; life: number; maxLife: number } | null = null;
  flash = 0;
  /** 개발용: 이 순서대로 번호를 뽑는다. App 이 개발 모드에서만 설정한다 */
  forcedNumbers: number[] | null = null;

  private press: Press | null = null;
  private lastSnapKey = "";
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private readonly sound: SoundSystem,
    private readonly events: GameEvents,
  ) {
    this.init();
  }

  /** 새 게임. 번호판이 비워졌음을 React 쪽에 알린다 */
  reset() {
    this.init();
    this.emitChange(true);
  }

  private init() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.pool = Array.from({ length: 45 }, (_, i) => i + 1);
    this.drawn = [];
    this.balls = [];
    this.arrow = null;
    this.parts = [];
    this.rockets = [];
    this.texts = [];
    this.banner = null;
    this.flash = 0;
    this.done = false;
    this.auto = false;
    this.press = null;
    this.balloons = Array.from({ length: BALLOON.count }, () => newBalloon(rnd(70, 360)));
    this.archer = { phase: "idle", t: 0, target: null, talk: null, talkT: 0, recoil: 0, power: 0, angle: -0.12, pointer: { x: 0, y: 0 } };
    this.chick = { jump: 0, vy: 0, talk: null, talkT: 0 };
  }

  // ---------- 상태 ----------
  get busy() {
    const p = this.archer.phase;
    return p === "drawing" || p === "aiming" || p === "release" || !!this.arrow;
  }

  /** 이미 뽑았거나 날아가는 중인 화살 수 */
  get shotsUsed() {
    return this.drawn.length + (this.busy ? 1 : 0);
  }

  get canFire() {
    return !this.done && !this.busy && this.shotsUsed < TOTAL_BALLS;
  }

  snapshot(): Snapshot {
    return {
      drawn: [...this.drawn],
      settled: this.balls.filter((b) => b.state === "done").map((b) => b.slot),
      done: this.done,
      canFire: this.canFire,
      auto: this.auto,
    };
  }

  private emitChange(force = false) {
    const s = this.snapshot();
    const key = JSON.stringify(s);
    if (!force && key === this.lastSnapKey) return;
    this.lastSnapKey = key;
    this.events.onChange(s);
  }

  private later(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms));
  }

  // ---------- 조작 ----------
  setAuto(on: boolean) {
    this.auto = on && !this.done;
    this.emitChange();
  }

  /** 자동 조준 발사. target 을 주면 그 풍선을 노린다 */
  fire(target?: Balloon | null) {
    if (!this.canFire) return;
    const b = target ?? this.pickTarget();
    if (!b) return;
    const a = this.archer;
    a.phase = "drawing";
    a.t = 0;
    a.target = b;
    this.say(pick(ARCHER_LINES), 1.1);
  }

  pointerDown(p: Point) {
    this.press = { start: { ...p }, at: this.time, aiming: false };
    this.archer.pointer = { ...p };
  }

  pointerMove(p: Point) {
    if (!this.press) return;
    this.archer.pointer = { ...p };
    if (!this.press.aiming && Math.hypot(p.x - this.press.start.x, p.y - this.press.start.y) > AIM.dragThreshold) this.beginAim();
  }

  pointerUp() {
    const press = this.press;
    this.press = null;
    if (!press) return;
    if (press.aiming) {
      this.releaseAim();
      return;
    }
    // 짧게 탭: 탭한 곳 근처 풍선을 자동 조준
    const { x, y } = press.start;
    let best: Balloon | null = null;
    let bd = Infinity;
    for (const b of this.balloons) {
      const d = Math.hypot(balloonX(b) - x, b.y - y);
      if (d < b.r + 22 && d < bd) {
        bd = d;
        best = b;
      }
    }
    this.fire(best);
  }

  pointerCancel() {
    if (this.press?.aiming && this.archer.phase === "aiming") this.archer.phase = "idle";
    this.press = null;
  }

  private beginAim() {
    if (!this.press || !this.canFire) return;
    this.press.aiming = true;
    this.auto = false;
    Object.assign(this.archer, { phase: "aiming", t: 0, power: 0, target: null });
    this.sound.play("grab");
    this.sound.play("creak");
  }

  private releaseAim() {
    const a = this.archer;
    if (a.phase !== "aiming") return;
    if (a.power < AIM.minPower) {
      a.phase = "idle";
      return;
    }
    const v = this.launchVelocity();
    this.arrow = { x: BOW_TIP.x, y: BOW_TIP.y, a: a.angle, vx: v.x, vy: v.y, manual: true, target: null, trail: [] };
    this.launched();
  }

  launchVelocity(): Point {
    const a = this.archer;
    const speed = ARROW.minSpeed + (ARROW.maxSpeed - ARROW.minSpeed) * a.power;
    return { x: Math.cos(a.angle) * speed, y: Math.sin(a.angle) * speed };
  }

  /** 직접 조준 궤적 미리보기 점들 */
  aimPreview(): Point[] {
    const v = this.launchVelocity();
    const pts: Point[] = [];
    let { x, y } = BOW_TIP;
    let { x: vx, y: vy } = v;
    const steps = 9;
    const dt = AIM.previewTime / steps;
    for (let i = 0; i < steps; i++) {
      vy += ARROW.gravity * dt;
      vx += this.wind.speed * ARROW.windPush * dt;
      x += vx * dt;
      y += vy * dt;
      pts.push({ x, y });
    }
    return pts;
  }

  private launched() {
    Object.assign(this.archer, { phase: "release", t: 0, recoil: 1 });
    this.sound.play("twang");
    this.sound.play("whoosh");
  }

  private pickTarget() {
    const ok = this.balloons.filter((b) => b.y > BALLOON.targetMinY && b.y < BALLOON.targetMaxY);
    return ok.length ? pick(ok) : null;
  }

  private say(text: string, sec: number) {
    this.archer.talk = text;
    this.archer.talkT = sec;
  }

  private chickSay(text: string, sec: number, jump = 0) {
    this.chick.talk = text;
    this.chick.talkT = sec;
    if (jump) this.chick.vy = -jump;
  }

  // ---------- 사건 ----------
  private pop(b: Balloon) {
    const i = this.balloons.indexOf(b);
    if (i < 0) return;
    this.balloons.splice(i, 1);
    this.later(() => this.balloons.push(newBalloon()), rnd(...BALLOON.respawnDelay));

    const x = balloonX(b);
    const slot = this.drawn.length;
    const forced = this.forcedNumbers?.[slot];
    const idx = forced !== undefined && this.pool.includes(forced) ? this.pool.indexOf(forced) : cryptoInt(this.pool.length);
    const n = this.pool.splice(idx, 1)[0];
    this.drawn.push(n);
    this.balls.push({ n, x, y: b.y, vy: -260, slot, state: "fall", ang: 0, s: 0.2 });

    for (let k = 0; k < 36; k++) {
      const a = rnd(0, 6.28);
      const s = rnd(120, 420);
      const life = rnd(0.7, 1.3);
      this.parts.push({ kind: "confetti", x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, c: k % 3 ? b.c : BALLOON_COLORS[k % 7], r: rnd(0, 6.28), vr: rnd(-10, 10), life, maxLife: life, w: rnd(4, 8) });
    }
    this.texts.push({ x, y: b.y - 10, t: "펑!", life: 0.7 });
    if (!this.reduceMotion) this.shake = 0.25;
    this.sound.play("pop");
  }

  private missed(at: Point) {
    this.texts.push({ x: clamp(at.x, 60, W - 60), y: clamp(at.y, 50, GY - 40), t: "빗나감!", life: 0.8 });
    this.chickSay("아까워!", 1);
    this.sound.play("miss");
  }

  private landed(b: Ball) {
    this.chickSay(b.slot === TOTAL_BALLS - 1 ? "보너스다!" : pick(CHICK_CHEERS), 1.2, 330);
    this.sound.play("ding", b.slot);
    this.later(() => this.sound.play("tweet"), 120);
    if (this.balls.length === TOTAL_BALLS && this.balls.every((x) => x.state === "done")) this.finish();
  }

  private finish() {
    this.done = true;
    this.auto = false;
    this.later(() => this.sound.play("fanfare"), 250);
    this.say("완벽해!", 2);
    this.chickSay("부자 되자!", 2, 380);
    if (this.theme === "night") this.launchFireworks();
    else this.dropConfetti();
    const main = this.drawn.slice(0, MAIN_BALLS).sort((a, b) => a - b);
    this.events.onFinish(main, this.drawn[MAIN_BALLS]);
  }

  private dropConfetti() {
    for (let k = 0; k < 120; k++) {
      const life = rnd(1.8, 3);
      this.parts.push({ kind: "confetti", x: rnd(0, W), y: rnd(-60, 0), vx: rnd(-40, 40), vy: rnd(40, 200), c: BALLOON_COLORS[k % 7], r: rnd(0, 6), vr: rnd(-8, 8), life, maxLife: life, w: rnd(5, 9) });
    }
  }

  private launchFireworks() {
    for (let i = 0; i < 7; i++) {
      this.rockets.push({ x: rnd(280, 760), y: GY, vx: rnd(-30, 30), vy: rnd(-520, -420), c: BALLOON_COLORS[i % 7], delay: 0.3 + i * 0.35 });
    }
  }

  /** 다 뽑은 번호가 지난 회차 1·2등 번호였을 때 */
  celebrate(rank: 1 | 2) {
    this.banner = { text: `역대 ${rank}등!`, life: 4.5, maxLife: 4.5 };
    this.flash = 1;
    if (!this.reduceMotion) this.shake = 0.45;
    this.say(rank === 1 ? "말도 안 돼!" : "거의 1등이야!", 3);
    this.chickSay("삐약삐약!!", 3, 420);
    this.later(() => this.sound.play("jackpot"), 1100);
    for (let i = 0; i < 12; i++) {
      this.rockets.push({ x: rnd(240, 780), y: GY, vx: rnd(-40, 40), vy: rnd(-560, -440), c: GOLD[i % GOLD.length], delay: 0.2 + i * 0.22 });
    }
    for (let k = 0; k < 160; k++) {
      const life = rnd(2.2, 3.6);
      this.parts.push({ kind: "confetti", x: rnd(0, W), y: rnd(-120, 0), vx: rnd(-50, 50), vy: rnd(40, 220), c: GOLD[k % GOLD.length], r: rnd(0, 6), vr: rnd(-8, 8), life, maxLife: life, w: rnd(5, 10) });
    }
  }

  private explode(r: Rocket) {
    for (let k = 0; k < 60; k++) {
      const a = (k / 60) * Math.PI * 2 + rnd(-0.05, 0.05);
      const s = rnd(80, 260);
      const life = rnd(1.2, 1.8);
      this.parts.push({ kind: "spark", x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c: k % 4 ? r.c : "#fff6c8", r: 0, vr: 0, life, maxLife: life, w: rnd(1.6, 2.8) });
    }
    this.sound.play("boom");
  }

  // ---------- 한 프레임 ----------
  update(dt: number) {
    this.time += dt;
    const wind = this.wind;
    wind.update(dt);
    moveClouds(this.clouds, wind.speed, dt);

    for (const b of this.balloons) {
      b.y += b.vy * dt;
      b.ph += dt * b.wob;
      b.x = clamp(b.x + wind.speed * WIND.balloonDrift * dt, BALLOON.minX - 20, BALLOON.maxX + 20);
      if (b.y < -70) Object.assign(b, newBalloon());
    }

    this.updateArcher(dt);
    this.updateArrow(dt);
    this.updateBalls(dt);

    const c = this.chick;
    c.vy += 1400 * dt;
    c.jump = Math.min(0, c.jump + c.vy * dt);
    if (c.jump === 0) c.vy = 0;
    c.talkT -= dt;

    for (const r of this.rockets) {
      r.delay -= dt;
      if (r.delay > 0) continue;
      if (r.y === GY) this.sound.play("launch");
      r.vy += 300 * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
    }
    for (const r of this.rockets) if (r.delay <= 0 && r.vy > -60) this.explode(r);
    this.rockets = this.rockets.filter((r) => r.delay > 0 || r.vy <= -60);

    for (const p of this.parts) {
      p.vy += (p.kind === "spark" ? 120 : 600) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.kind === "spark" ? 0.97 : 0.99;
      p.vy *= p.kind === "spark" ? 0.97 : 1;
      p.r += p.vr * dt;
      p.life -= dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0 && p.y < H + 20);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 40 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.banner && (this.banner.life -= dt) <= 0) this.banner = null;

    if (this.auto && this.canFire) this.fire();
    this.emitChange();
  }

  private updateArcher(dt: number) {
    const a = this.archer;
    // 누른 채로 잠시 있으면 끌지 않아도 직접 조준 시작
    if (this.press && !this.press.aiming && this.time - this.press.at > AIM.holdThreshold) this.beginAim();

    switch (a.phase) {
      case "drawing": {
        const prev = a.t;
        a.t += dt;
        if (prev < 0.02) this.sound.play("grab");
        if (prev < 0.08 && a.t >= 0.08) this.sound.play("creak");
        if (a.t > DRAW_TIME) {
          if (!a.target || !this.balloons.includes(a.target)) a.target = this.pickTarget();
          this.arrow = { x: BOW_TIP.x, y: BOW_TIP.y, a: -0.12, vx: 0, vy: 0, manual: false, target: a.target, trail: [] };
          this.launched();
        }
        break;
      }
      case "aiming":
        a.t += dt;
        a.power = Math.min(1, a.t / AIM.fullDrawTime);
        a.angle = clamp(Math.atan2(a.pointer.y - SHOULDER.y, a.pointer.x - SHOULDER.x), AIM.minAngle, AIM.maxAngle);
        break;
      case "release":
        a.t += dt;
        if (a.t > 0.36) Object.assign(a, { phase: "after", t: 0, target: null });
        break;
      case "after":
        a.t += dt;
        if (a.t > 0.95) a.phase = "idle";
        break;
    }
    a.recoil = Math.max(0, a.recoil - dt * 5);
    a.talkT -= dt;
  }

  private updateArrow(dt: number) {
    const ar = this.arrow;
    if (!ar) return;
    let hit: Balloon | null = null;

    if (ar.manual) {
      ar.vy += ARROW.gravity * dt;
      ar.vx += this.wind.speed * ARROW.windPush * dt;
      ar.x += ar.vx * dt;
      ar.y += ar.vy * dt;
      ar.a = Math.atan2(ar.vy, ar.vx);
      hit = this.balloons.find((b) => Math.hypot(balloonX(b) - ar.x, b.y - ar.y) < b.r + 4) ?? null;
    } else {
      // 유도 화살: 목표 풍선 쪽으로 방향을 틀며 날아간다
      let t = ar.target;
      if (!t || !this.balloons.includes(t)) t = ar.target = this.pickTarget();
      if (t) {
        let d = Math.atan2(t.y - ar.y, balloonX(t) - ar.x) - ar.a;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        ar.a += d * Math.min(1, dt * 9);
      }
      ar.x += Math.cos(ar.a) * ARROW.homingSpeed * dt;
      ar.y += Math.sin(ar.a) * ARROW.homingSpeed * dt;
      if (t && Math.hypot(balloonX(t) - ar.x, t.y - ar.y) < t.r + 4) hit = t;
    }

    ar.trail.push({ x: ar.x, y: ar.y });
    if (ar.trail.length > 10) ar.trail.shift();

    if (hit) {
      this.pop(hit);
      this.arrow = null;
    } else if (ar.x > W + 60 || ar.x < -60 || ar.y < -60 || ar.y > GY) {
      this.missed(ar);
      this.arrow = null;
    }
  }

  private updateBalls(dt: number) {
    for (const b of this.balls) {
      b.s = Math.min(1, b.s + dt * 4);
      const sx = slotX(b.slot);
      if (b.state === "fall") {
        b.vy += 1500 * dt;
        b.y += b.vy * dt;
        const dx = (sx - b.x) * dt * 0.9;
        b.x += dx;
        b.ang += dx / R;
        if (b.y > GY - R) {
          b.y = GY - R;
          if (b.vy > 140) this.sound.play("bounce", Math.min(1, b.vy / 900));
          b.vy = -b.vy * 0.45;
          if (Math.abs(b.vy) < 110) {
            b.vy = 0;
            b.state = "roll";
          }
        }
      } else if (b.state === "roll") {
        const dx = (sx - b.x) * Math.min(1, dt * 3.2);
        b.x += dx;
        b.ang += dx / R;
        if (Math.abs(sx - b.x) < 0.6) {
          b.x = sx;
          b.state = "done";
          this.landed(b);
        }
      } else {
        // 숫자가 똑바로 보이도록 회전을 정리
        const upright = Math.round(b.ang / (Math.PI * 2)) * Math.PI * 2;
        b.ang += (upright - b.ang) * Math.min(1, dt * 6);
      }
    }
  }
}
