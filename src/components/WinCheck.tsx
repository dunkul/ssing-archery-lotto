import { useMemo } from "react";
import { expectedLatestRound, isPending, type DrawsResult } from "../lotto/draws";
import { formatWon } from "../lotto/rank";
import { Ball } from "./Ball";

interface Props {
  data: DrawsResult | null;
  error: boolean;
  round: number | null;
  onRound(round: number): void;
}

/** 실제 당첨번호: 회차를 고르면 아래 '지난 게임'이 그 회차 기준으로 채점된다 */
export function WinCheck({ data, error, round, onRound }: Props) {
  const rounds = useMemo(() => (data ? [...data.draws.keys()].sort((a, b) => b - a) : []), [data]);
  const draw = data && round ? data.draws.get(round) : undefined;

  return (
    <section className="win card">
      <h2>
        <span>당첨 번호 확인</span>
        {data && round && (
          <span className="round-nav">
            <button className="small" onClick={() => onRound(round - 1)} disabled={!data.draws.has(round - 1)} aria-label="이전 회차">
              ◀
            </button>
            <select value={round} onChange={(e) => onRound(Number(e.target.value))} aria-label="회차 선택">
              {rounds.map((r) => (
                <option key={r} value={r}>
                  제{r}회
                </option>
              ))}
            </select>
            <button className="small" onClick={() => onRound(round + 1)} disabled={!data.draws.has(round + 1)} aria-label="다음 회차">
              ▶
            </button>
          </span>
        )}
      </h2>

      {error && <p className="note">당첨 번호 데이터를 불러오지 못했어요.</p>}
      {!error && !data && <p className="note">당첨 번호를 불러오는 중…</p>}
      {draw && (
        <>
          <div className="balls">
            {draw.numbers.map((n) => (
              <Ball key={n} n={n} />
            ))}
            <span className="plus">+</span>
            <Ball n={draw.bonus} />
          </div>
          <p className="note">
            {draw.date} 추첨 ·{" "}
            {isPending(draw)
              ? "당첨금은 아직 집계 중이에요"
              : draw.firstWinners
                ? `1등 ${draw.firstWinners}명 · 1인당 ${formatWon(draw.firstPrize)}`
                : "1등 없음 (이월)"}
          </p>
        </>
      )}
      {data?.stale && round === data.latest && (
        <p className="note">제{expectedLatestRound()}회 결과는 아직 받아오지 못했어요. 잠시 후 다시 열어 보세요.</p>
      )}
    </section>
  );
}
