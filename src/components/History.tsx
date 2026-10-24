import { useMemo } from "react";
import type { Draw } from "../lotto/draws";
import { findPastWins, rankOf } from "../lotto/rank";
import { Ball } from "./Ball";

export interface HistoryEntry {
  /** 게임 번호 */
  g: number;
  main: number[];
  bonus: number;
}

interface Props {
  history: HistoryEntry[];
  /** 채점 기준 회차 (없으면 채점하지 않음) */
  draw?: Draw;
  /** 전체 회차: 역대 1·2등이었던 기록에 배지를 붙인다 */
  draws?: Map<number, Draw>;
}

export function History({ history, draw, draws }: Props) {
  const pastWins = useMemo(() => new Map(history.map((h) => [h.g, draws ? findPastWins(h.main, draws) : []])), [history, draws]);

  return (
    <section className="hist">
      <h2>
        <span>지난 게임</span>
        {draw && history.length > 0 && <small>제{draw.round}회 기준 채점</small>}
      </h2>
      {history.length === 0 ? (
        <p className="note">아직 완성된 게임이 없어요. 7발을 모두 맞히면 여기에 쌓여요.</p>
      ) : (
        <ol>
          {history.map((h) => {
            const result = draw && rankOf(h.main, draw);
            const best = pastWins.get(h.g)?.[0];
            return (
              <li key={h.g} className={best ? "jackpot-row" : undefined}>
                <span className="k">{h.g}게임</span>
                {h.main.map((n) => {
                  const cls = !result ? "" : result.hits.has(n) ? "hit" : n === draw.bonus ? "hit-bonus" : "miss";
                  return <Ball key={n} n={n} className={cls} />;
                })}
                <span className="plus">+</span>
                <Ball n={h.bonus} className={result ? "miss" : ""} title="게임 보너스공 (채점에는 안 들어가요)" />
                {best && (
                  <span className="trophy" title="지난 회차 1·2등 번호와 같아요">
                    🏆 제{best.draw.round}회 {best.rank}등
                  </span>
                )}
                {result && <span className={`rank r${result.rank}`}>{result.rank ? `${result.rank}등` : "낙첨"}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
