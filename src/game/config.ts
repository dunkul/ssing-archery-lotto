// 게임 화면·물리·연출에 쓰는 상수 모음. 배치를 바꾸려면 여기만 고치면 된다.

/** 캔버스 논리 크기 (실제 픽셀은 화면 크기 × DPR 로 맞춘다) */
export const W = 800;
export const H = 480;
/** 지면 높이(y) */
export const GY = 404;
/** 로또공 반지름 */
export const R = 22;

export const TOTAL_BALLS = 7; // 본번호 6 + 보너스 1
export const MAIN_BALLS = 6;

/** 공이 굴러가 멈추는 자리 */
export const SLOT = { firstX: 284, gap: 56, bonusX: 668, plusX: 618, plateX: 254, plateW: 448 };
export const slotX = (i: number) => (i < MAIN_BALLS ? SLOT.firstX + i * SLOT.gap : SLOT.bonusX);

export const BALLOON = {
  count: 9,
  minX: 340,
  maxX: 760,
  /** 이 높이 범위 안의 풍선만 자동 조준 대상이 된다 */
  targetMinY: 70,
  targetMaxY: 340,
  respawnDelay: [400, 1200] as const,
};
export const BALLOON_COLORS = ["#ff5d3d", "#ffd23f", "#4cc9f0", "#9b5de5", "#f15bb5", "#00bb7a", "#ff8c42"];

/** 궁수 스프라이트: 8프레임 234×216
 *  0 대기, 1 화살 걸기, 2 끝까지 당김, 3 조준, 4 환호, 5 발사(윙크), 6 미소, 7 활 내림 */
export const SPRITE = { frameW: 234, frameH: 216, footX: 93, x: 18 };
export const SPRITE_Y = GY - SPRITE.frameH;
/** 화살이 출발하는 활 끝 위치 */
export const BOW_TIP = { x: SPRITE.x + 185, y: SPRITE_Y + 79 };
export const SHOULDER = { x: SPRITE.x + 150, y: SPRITE_Y + 79 };
/** 자동 발사 때 프레임 순서와 각 프레임 길이(초) */
export const DRAW_SEQ: ReadonlyArray<readonly [frame: number, sec: number]> = [
  [0, 0.05],
  [1, 0.34],
  [2, 0.3],
  [3, 0.3],
];
export const DRAW_TIME = DRAW_SEQ.reduce((sum, [, sec]) => sum + sec, 0);

export const CHICK_X = 240;

export const ARROW = {
  /** 자동 조준(유도) 화살 속도 */
  homingSpeed: 1050,
  /** 직접 조준 화살 속도: 당긴 정도(0~1)에 따라 min~max */
  minSpeed: 520,
  maxSpeed: 1100,
  gravity: 260,
  /** 바람 1m/s 당 가로 가속도(px/s²) */
  windPush: 35,
};

export const AIM = {
  /** 이만큼 끌거나 누르고 있으면 직접 조준으로 전환 */
  dragThreshold: 14,
  holdThreshold: 0.22,
  /** 끝까지 당기는 데 걸리는 시간(초) */
  fullDrawTime: 0.7,
  /** 이보다 약하게 당겼다 놓으면 발사 취소 */
  minPower: 0.12,
  minAngle: -1.35,
  maxAngle: 0.3,
  /** 궤적 미리보기 길이(초) */
  previewTime: 0.32,
};

export const WIND = {
  /** 최대 풍속(m/s) */
  max: 4,
  /** 바람이 목표 풍속으로 바뀌는 데 걸리는 간격(초) */
  changeEvery: [5, 10] as const,
  /** 풍선이 바람 1m/s 당 옆으로 밀리는 속도(px/s) */
  balloonDrift: 6,
  cloudDrift: 8,
};

export const ARCHER_LINES = ["간다!", "명중이다!", "이번엔 1등!", "숨 참고…", "바람 계산 끝", "쏜다!"];
export const CHICK_CHEERS = ["대박!", "삐약!", "이거다!", "느낌 좋아", "한 개 더!", "오오오!"];

export const PALETTE = {
  day: {
    skyTop: "#5fb6ef",
    skyBottom: "#c9ecfb",
    hills: "#8fd18a",
    ground: "#5fb85a",
    grass: "#4ea24a",
    cloud: "rgba(255,255,255,.92)",
    trail: "rgba(255,255,255,.7)",
  },
  night: {
    skyTop: "#0b1638",
    skyBottom: "#34407a",
    hills: "#2c5640",
    ground: "#2f6a3b",
    grass: "#285c32",
    cloud: "rgba(200,210,240,.25)",
    trail: "rgba(255,240,180,.75)",
  },
} as const;

export const INK = "#1f2b45";
export const CORAL = "#ff5d3d";
