import { useEffect, useRef, type PointerEvent } from "react";
import archerUrl from "../assets/archer-sprite.png";
import arrowUrl from "../assets/arrow.png";
import { H, W } from "../game/config";
import type { Game } from "../game/engine";
import { render } from "../game/render";

const loadImage = (src: string) => Object.assign(new Image(), { src });

/** 게임 캔버스: 애니메이션 루프와 포인터 입력을 맡는다 */
export function Stage({ game }: { game: Game }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    const sprites = { archer: loadImage(archerUrl), arrow: loadImage(arrowUrl) };

    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      game.update(dt);
      render(ctx, game, sprites, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // 화면 크기 × DPR 로 캔버스 해상도를 맞춰 선명하게
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const w = cv.clientWidth || W;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(((w * dpr) * H) / W);
    });
    ro.observe(cv);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [game]);

  const toGame = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };

  return (
    <div className="stage">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        aria-label="궁수가 풍선을 쏘는 로또 추첨 무대"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          game.pointerDown(toGame(e));
        }}
        onPointerMove={(e) => game.pointerMove(toGame(e))}
        onPointerUp={() => game.pointerUp()}
        onPointerCancel={() => game.pointerCancel()}
      />
      <div className="hint">풍선을 탭하면 자동 조준 · 누른 채 끌면 직접 조준</div>
    </div>
  );
}
