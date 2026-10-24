export type Theme = "day" | "night";

export interface Point {
  x: number;
  y: number;
}

export interface Balloon {
  x: number;
  y: number;
  r: number;
  c: string;
  vy: number;
  /** 좌우 흔들림 위상 */
  ph: number;
  wob: number;
}

export interface Ball {
  n: number;
  x: number;
  y: number;
  vy: number;
  slot: number;
  state: "fall" | "roll" | "done";
  ang: number;
  /** 등장 시 커지는 배율 */
  s: number;
}

export interface Arrow {
  x: number;
  y: number;
  a: number;
  /** 직접 조준 화살만 속도를 가진다 (유도 화살은 a 방향으로 일정 속도) */
  vx: number;
  vy: number;
  manual: boolean;
  target: Balloon | null;
  trail: Point[];
}

export interface Particle {
  kind: "confetti" | "spark";
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: string;
  r: number;
  vr: number;
  life: number;
  maxLife: number;
  w: number;
}

export interface Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: string;
  delay: number;
}

export interface FloatText {
  x: number;
  y: number;
  t: string;
  life: number;
}

export interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  ph: number;
}

export type ArcherPhase = "idle" | "drawing" | "aiming" | "release" | "after";

export interface Archer {
  phase: ArcherPhase;
  t: number;
  target: Balloon | null;
  talk: string | null;
  talkT: number;
  recoil: number;
  /** 직접 조준: 당긴 정도 0~1, 조준 각도, 포인터 위치 */
  power: number;
  angle: number;
  pointer: Point;
}

export interface Chick {
  jump: number;
  vy: number;
  talk: string | null;
  talkT: number;
}

/** React 쪽으로 넘기는 게임 상태 요약 */
export interface Snapshot {
  drawn: number[];
  /** 자리에 도착한 공의 슬롯 번호 */
  settled: number[];
  done: boolean;
  canFire: boolean;
  auto: boolean;
}
