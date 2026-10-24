// 다 뽑은 번호에 붙이는 한 줄 코멘트
import { BALL_RANGES, ballRange } from "../game/util";
import type { Draw } from "./draws";

export function describe(main: number[], draws?: Map<number, Draw>): string[] {
  const s = [...main].sort((a, b) => a - b);
  const out: string[] = [];

  // 연속 번호
  const runs: number[][] = [];
  for (const n of s) {
    const last = runs.at(-1);
    if (last && n === last.at(-1)! + 1) last.push(n);
    else runs.push([n]);
  }
  const consecutive = runs.filter((r) => r.length >= 2);
  if (consecutive.length) out.push(`연속 번호 ${consecutive.map((r) => r.join("·")).join(", ")}`);

  // 홀짝 / 저고
  const odd = s.filter((n) => n % 2).length;
  out.push(`홀짝 ${odd}:${6 - odd}${odd === 0 || odd === 6 ? " — 꽤 드문 조합" : ""}`);
  const low = s.filter((n) => n <= 22).length;
  out.push(`저고 ${low}:${6 - low}`);

  // 합계: 역대 평균은 138 근처
  const sum = s.reduce((a, b) => a + b, 0);
  out.push(`번호 합 ${sum} — ${sum < 100 ? "낮은 편" : sum > 175 ? "높은 편" : "평균(138) 근처"}`);

  // 끝수 겹침
  const byEnd = new Map<number, number[]>();
  for (const n of s) byEnd.set(n % 10, [...(byEnd.get(n % 10) ?? []), n]);
  for (const [d, ns] of byEnd) if (ns.length >= 2) out.push(`끝수 ${d} 겹침 (${ns.join("·")})`);

  // 색깔(번호 구간)
  const counts = BALL_RANGES.map((_, i) => s.filter((n) => ballRange(n) === i).length);
  if (counts.every((c) => c > 0)) out.push("다섯 색깔이 모두 나왔어요");
  counts.forEach((c, i) => c >= 3 && out.push(`${BALL_RANGES[i].label} 구간에 ${c}개 몰림`));

  // 역대 당첨번호와 가장 많이 겹친 회차
  if (draws?.size) {
    let best: Draw | null = null;
    let bestHits = 0;
    for (const d of draws.values()) {
      const hits = d.numbers.filter((n) => s.includes(n)).length;
      if (hits > bestHits) [best, bestHits] = [d, hits];
    }
    if (best && bestHits === 6) out.push(`${best.round}회 1등 번호와 똑같아요!`);
    else if (best) out.push(`역대 최대 ${bestHits}개 일치 (${best.round}회)`);
  }
  return out;
}
