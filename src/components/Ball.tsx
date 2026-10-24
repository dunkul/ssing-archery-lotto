import type { CSSProperties } from "react";
import { ballColor } from "../game/util";

interface Props {
  n: number;
  className?: string;
  title?: string;
}

export function Ball({ n, className = "", title }: Props) {
  return (
    <span className={`b ${className}`} style={{ "--c": ballColor(n) } as CSSProperties} title={title}>
      {n}
    </span>
  );
}

export function EmptyBall({ label }: { label: string }) {
  return <span className="b empty">{label}</span>;
}
