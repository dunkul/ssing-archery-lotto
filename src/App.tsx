import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controls } from "./components/Controls";
import { History, type HistoryEntry } from "./components/History";
import { Jackpot } from "./components/Jackpot";
import { Stage } from "./components/Stage";
import { Ticket } from "./components/Ticket";
import { WinCheck } from "./components/WinCheck";
import { SoundSystem } from "./game/audio";
import { Game } from "./game/engine";
import type { Snapshot, Theme } from "./game/types";
import { themeForHour } from "./game/weather";
import { useStoredState } from "./hooks";
import { loadDraws, type DrawsResult } from "./lotto/draws";
import { findPastWins, type PastWin } from "./lotto/rank";
import { STORAGE_KEYS } from "./storage";

const HISTORY_MAX = 20;
const THEME_COLOR: Record<Theme, string> = { day: "#bfe3f7", night: "#0b1638" };
/** 캔버스 축하 연출을 먼저 보여 준 뒤 축하 창을 띄운다 */
const JACKPOT_DELAY_MS = 1600;

export default function App() {
  const [history, setHistory] = useStoredState<HistoryEntry[]>(STORAGE_KEYS.history, []);
  const [soundPrefs, setSoundPrefs] = useStoredState(STORAGE_KEYS.sound, { sfx: true, bgm: true });
  const [theme, setTheme] = useStoredState<Theme>(STORAGE_KEYS.theme, themeForHour);
  const [gameNo, setGameNo] = useState(() => (history[0]?.g ?? 0) + 1);

  // 게임 엔진은 한 번만 만든다. 끝났을 때 처리는 최신 상태를 쓰도록 ref 로 넘긴다
  const onFinishRef = useRef<(main: number[], bonus: number) => void>(() => {});
  const sound = useMemo(() => new SoundSystem(), []);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const game = useMemo(() => new Game(sound, { onChange: setSnap, onFinish: (m, b) => onFinishRef.current(m, b) }), [sound]);
  const view = snap ?? game.snapshot();

  // 당첨번호
  const [draws, setDraws] = useState<DrawsResult | null>(null);
  const [jackpot, setJackpot] = useState<{ main: number[]; wins: PastWin[] } | null>(null);
  const jackpotTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  onFinishRef.current = (main, bonus) => {
    setHistory((h) => [{ g: gameNo, main, bonus }, ...h].slice(0, HISTORY_MAX));
    const wins = draws ? findPastWins(main, draws.draws) : [];
    if (!wins.length) return;
    game.celebrate(wins[0].rank);
    jackpotTimer.current = setTimeout(() => setJackpot({ main, wins }), JACKPOT_DELAY_MS);
  };

  // 개발용: ?rig=회차 로 열면 그 회차 1등 번호를, ?rig=회차&rank=2 면 2등 번호를 그대로 뽑는다. 축하 연출 확인용
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const d = import.meta.env.DEV ? draws?.draws.get(Number(params.get("rig"))) : undefined;
    if (!d) return;
    const [n1, n2, n3, n4, n5, n6] = d.numbers;
    game.forcedNumbers = params.get("rank") === "2" ? [n1, n2, n3, n4, n5, d.bonus, n6] : [...d.numbers, d.bonus];
  }, [game, draws]);
  const [drawsError, setDrawsError] = useState(false);
  const [round, setRound] = useState<number | null>(null);
  useEffect(() => {
    loadDraws()
      .then((d) => {
        setDraws(d);
        setRound(d.latest);
      })
      .catch(() => setDrawsError(true));
  }, []);

  // 테마
  useEffect(() => {
    game.theme = theme;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  }, [game, theme]);

  // 소리: 첫 입력 후에만 재생 가능
  const soundRef = useRef(soundPrefs);
  soundRef.current = soundPrefs;
  const unlocked = useRef(false);
  useEffect(() => {
    sound.sfxOn = soundPrefs.sfx;
    if (!unlocked.current) return;
    if (soundPrefs.bgm) sound.startBgm();
    else sound.stopBgm();
  }, [sound, soundPrefs]);

  useEffect(() => {
    const unlock = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      sound.unlock();
      if (soundRef.current.bgm) sound.startBgm();
    };
    const onVisibility = () => sound.setHidden(document.hidden);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code !== "Space" || tag === "BUTTON" || tag === "SELECT" || tag === "INPUT") return;
      e.preventDefault();
      game.fire();
    };
    addEventListener("pointerdown", unlock, { capture: true });
    addEventListener("keydown", unlock, { capture: true });
    addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      removeEventListener("pointerdown", unlock, { capture: true });
      removeEventListener("keydown", unlock, { capture: true });
      removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      sound.stopBgm();
    };
  }, [game, sound]);

  const reset = () => {
    if (game.done) setGameNo((n) => n + 1);
    clearTimeout(jackpotTimer.current);
    setJackpot(null);
    game.reset();
  };

  const closeJackpot = useCallback(() => setJackpot(null), []);

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>
            씽씽 <span>활쏘기</span> 로또
          </h1>
          <p className="sub">궁수가 풍선을 맞히면 안에 숨은 로또공이 굴러 나와요. 1~45 중 6개 + 보너스 1개.</p>
        </div>
        <div className="round">{gameNo}게임</div>
      </header>

      <Stage game={game} />

      <Controls
        canFire={view.canFire}
        auto={view.auto}
        done={view.done}
        sfx={soundPrefs.sfx}
        bgm={soundPrefs.bgm}
        theme={theme}
        onFire={() => game.fire()}
        onAuto={() => game.setAuto(!game.auto)}
        onReset={reset}
        onToggleSfx={() => {
          setSoundPrefs((p) => ({ ...p, sfx: !p.sfx }));
          if (!soundPrefs.sfx) setTimeout(() => sound.play("tweet"));
        }}
        onToggleBgm={() => setSoundPrefs((p) => ({ ...p, bgm: !p.bgm }))}
        onToggleTheme={() => setTheme((t) => (t === "night" ? "day" : "night"))}
      />

      <Ticket snap={view} draws={draws?.draws} />
      <WinCheck data={draws} error={drawsError} round={round} onRound={setRound} />
      <History history={history} draw={round ? draws?.draws.get(round) : undefined} draws={draws?.draws} />

      <p className="credit">당첨 번호 출처: 동행복권 · 이 게임의 번호는 재미로만 봐 주세요.</p>
      {jackpot && <Jackpot main={jackpot.main} wins={jackpot.wins} onClose={closeJackpot} />}
    </div>
  );
}
