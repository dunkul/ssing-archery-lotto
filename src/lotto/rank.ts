import type { Draw } from "./draws";

export interface RankResult {
  /** 1~5등, 낙첨은 0 */
  rank: number;
  hits: Set<number>;
  bonusHit: boolean;
}

/** 1등 6개 / 2등 5개+보너스 / 3등 5개 / 4등 4개 / 5등 3개 */
export function rankOf(main: number[], draw: Draw): RankResult {
  const win = new Set(draw.numbers);
  const hits = new Set(main.filter((n) => win.has(n)));
  const bonusHit = main.includes(draw.bonus);
  const k = hits.size;
  const rank = k === 6 ? 1 : k === 5 ? (bonusHit ? 2 : 3) : k === 4 ? 4 : k === 3 ? 5 : 0;
  return { rank, hits, bonusHit };
}

/** 1881025430 → "18억 8,103만원" */
export function formatWon(won: number) {
  if (!won) return "-";
  const eok = Math.floor(won / 1e8);
  const man = Math.round((won % 1e8) / 1e4);
  return [eok && `${eok}억`, man && `${man.toLocaleString("ko-KR")}만`].filter(Boolean).join(" ") + "원";
}

export interface PastWin {
  draw: Draw;
  rank: 1 | 2;
}

/** 이 번호가 지난 회차에서 1·2등이었던 경우. 높은 등수, 최근 회차 순 */
export function findPastWins(main: number[], draws: Map<number, Draw>): PastWin[] {
  const wins: PastWin[] = [];
  for (const draw of draws.values()) {
    const { rank } = rankOf(main, draw);
    if (rank === 1 || rank === 2) wins.push({ draw, rank });
  }
  return wins.sort((a, b) => a.rank - b.rank || b.draw.round - a.draw.round);
}

/** 그 회차 그 등수의 1인당 당첨금 (예전에 저장된 데이터엔 2등 금액이 없을 수 있다) */
export const prizeOf = ({ draw, rank }: PastWin) => (rank === 1 ? draw.firstPrize : draw.secondPrize) ?? 0;
