import { useEffect, useMemo, useState } from "react";
import { MAIN_BALLS } from "../game/config";
import type { Snapshot } from "../game/types";
import { BALL_RANGES } from "../game/util";
import { describe } from "../lotto/analysis";
import type { Draw } from "../lotto/draws";
import { Ball, EmptyBall } from "./Ball";

interface Props {
  snap: Snapshot;
  draws?: Map<number, Draw>;
}

/** 이번 게임 번호판 */
export function Ticket({ snap, draws }: Props) {
  const { drawn, done } = snap;
  const settled = new Set(snap.settled);
  const main = done ? drawn.slice(0, MAIN_BALLS).sort((a, b) => a - b) : drawn.slice(0, MAIN_BALLS).map((n, i) => (settled.has(i) ? n : null));
  const bonus = settled.has(MAIN_BALLS) ? drawn[MAIN_BALLS] : null;

  const comments = useMemo(() => (done ? describe(drawn.slice(0, MAIN_BALLS), draws) : []), [done, drawn, draws]);

  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setMessage(null), [drawn.length, done]);

  const status = done ? "정렬된 최종 번호예요. 행운을 빌어요!" : drawn.length ? `${settled.size}/7 개 도착` : "궁수가 대기 중이에요. 발사 버튼을 눌러보세요.";

  const copy = () => {
    if (!done) {
      setMessage("7개를 모두 뽑은 뒤 복사할 수 있어요.");
      return;
    }
    const text = `${main.join(", ")} + 보너스 ${bonus}`;
    navigator.clipboard
      ?.writeText(text)
      .then(() => setMessage(`복사했어요: ${text}`))
      .catch(() => setMessage(text));
  };

  return (
    <section className="ticket card" aria-live="polite">
      <h2>
        <span>이번 번호</span>
        <button className="small" onClick={copy}>
          번호 복사
        </button>
      </h2>
      <div className="balls">
        {Array.from({ length: MAIN_BALLS }, (_, i) => {
          const n = main[i];
          return n ? <Ball key={n} n={n} className="pop" /> : <EmptyBall key={`e${i}`} label="?" />;
        })}
        <span className="plus">+</span>
        {bonus ? <Ball key={bonus} n={bonus} className="pop" /> : <EmptyBall label="B" />}
      </div>
      {comments.length > 0 && (
        <ul className="chips">
          {comments.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <div className="legend">
        {BALL_RANGES.map((r) => (
          <span key={r.label}>
            <i style={{ background: r.color }} />
            {r.label}
          </span>
        ))}
      </div>
      <div className="toast">{message ?? status}</div>
    </section>
  );
}
