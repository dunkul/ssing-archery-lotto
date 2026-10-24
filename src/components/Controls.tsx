import type { Theme } from "../game/types";

interface Props {
  canFire: boolean;
  auto: boolean;
  done: boolean;
  sfx: boolean;
  bgm: boolean;
  theme: Theme;
  onFire(): void;
  onAuto(): void;
  onReset(): void;
  onToggleSfx(): void;
  onToggleBgm(): void;
  onToggleTheme(): void;
}

export function Controls(p: Props) {
  return (
    <div className="controls">
      <button className="fire" onClick={p.onFire} disabled={!p.canFire}>
        🏹 발사! <small>(스페이스)</small>
      </button>
      <button className="auto" onClick={p.onAuto} disabled={p.done}>
        {p.auto ? "연속 발사 멈춤" : "연속 발사"}
      </button>
      <button onClick={p.onReset}>다시 하기</button>
      <div className="opts">
        <button className="tog" aria-pressed={p.sfx} onClick={p.onToggleSfx}>
          🔊 효과음
        </button>
        <button className="tog" aria-pressed={p.bgm} onClick={p.onToggleBgm}>
          🎵 배경음악
        </button>
        <button className="tog theme" onClick={p.onToggleTheme} aria-label="낮/밤 바꾸기">
          {p.theme === "night" ? "🌙 밤" : "☀️ 낮"}
        </button>
      </div>
    </div>
  );
}
