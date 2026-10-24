export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 번호 추첨용 난수: Math.random 대신 crypto 사용 */
export function cryptoInt(n: number) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

/** 실제 로또공 색: 1–10 노랑, 11–20 파랑, 21–30 빨강, 31–40 회색, 41–45 초록 */
export const BALL_RANGES = [
  { max: 10, color: "#f6bd16", label: "1–10" },
  { max: 20, color: "#3a86e0", label: "11–20" },
  { max: 30, color: "#e84b41", label: "21–30" },
  { max: 40, color: "#8b909a", label: "31–40" },
  { max: 45, color: "#3bb14c", label: "41–45" },
] as const;

export const ballRange = (n: number) => BALL_RANGES.findIndex((r) => n <= r.max);
export const ballColor = (n: number) => BALL_RANGES[ballRange(n)].color;

/** #rrggbb 를 어둡게 */
export function shade(hex: string, f = 0.68) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.floor(v * f));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
