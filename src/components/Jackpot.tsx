import { useEffect, useRef } from "react";
import { formatWon, prizeOf, type PastWin } from "../lotto/rank";
import { Ball } from "./Ball";

interface Props {
  main: number[];
  wins: PastWin[];
  onClose(): void;
}

/** 다 뽑은 번호가 지난 회차 1·2등 번호였을 때 뜨는 축하 창 */
export function Jackpot({ main, wins, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const top = wins[0];
  const { draw, rank } = top;
  const prize = prizeOf(top);
  const others = wins.slice(1);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const win = new Set(draw.numbers);

  return (
    <div className="jackpot" role="dialog" aria-modal="true" aria-labelledby="jackpot-title" onClick={onClose}>
      <div className="jackpot-rays" aria-hidden="true" />
      <div className="jackpot-card" onClick={(e) => e.stopPropagation()}>
        <p className="jackpot-kicker">믿기지 않아요!</p>
        <h2 id="jackpot-title">
          역대 <em>{rank}등</em> 번호!
        </h2>
        <p>
          제{draw.round}회({draw.date}) {rank}등 번호와 {rank === 1 ? "6개가 모두" : "5개 + 보너스가"} 맞아요.
        </p>
        <div className="balls">
          {main.map((n) => (
            <Ball key={n} n={n} className={win.has(n) ? "hit" : n === draw.bonus ? "hit-bonus" : "miss"} />
          ))}
        </div>
        {prize > 0 && (
          <p className="jackpot-prize">
            그 회차였다면 <strong>{formatWon(prize)}</strong>
          </p>
        )}
        {others.length > 0 && (
          <p className="note">
            다른 회차에서도 맞아요: {others.map((w) => `제${w.draw.round}회 ${w.rank}등`).join(", ")}
          </p>
        )}
        <button ref={closeRef} className="fire" onClick={onClose}>
          계속하기
        </button>
      </div>
    </div>
  );
}
