# AGENTS.md

씽씽 활쏘기 로또: 궁수가 풍선을 쏘면 로또공(1~45, 6개 + 보너스)이 굴러 나오는 웹 게임.
Vite + React 19 + TypeScript. 서버 없음 (빌드 결과는 정적 파일).

## 명령

```bash
npm run dev           # 개발 서버 :5173 (PWA 서비스워커는 dev 에서 꺼져 있음)
npx tsc -b            # 타입 검사 — 수정 후 항상 실행
npm run build         # prebuild 로 update-draws 실행 → tsc → vite build → dist/
npm run preview       # dist 확인 :4173 (서비스워커까지 확인하려면 이걸로)
npm run update-draws  # public/data/draws.json 에 없는 회차만 추가
```

테스트 프레임워크는 없다. 변경 후 최소한 `npx tsc -b` 와 `npm run build` 를 통과시키고,
게임 동작을 바꿨다면 브라우저에서 한 판(연속 발사로 7개)을 끝까지 돌려 콘솔 오류가 없는지 확인한다.

## 구조와 경계

```
src/game/      캔버스 게임. React 를 import 하지 않는다.
  config.ts    화면 배치·물리·연출 상수 (매직 넘버는 여기로)
  engine.ts    Game 클래스: 상태 + update(dt) + 입력(fire, pointerDown/Move/Up)
  render.ts    render(ctx, game, sprites, now) — 상태를 읽기만 한다
  weather.ts   Wind, 구름·별 생성, themeForHour
  audio.ts     SoundSystem — Web Audio 합성 (음원 파일 없음)
  types.ts     공용 타입, Snapshot
src/lotto/     당첨번호 데이터 (draws.ts), 등수 (rank.ts), 결과 코멘트 (analysis.ts)
src/components React UI: Stage(캔버스+루프+포인터), Controls, Ticket, WinCheck, History, Ball
src/App.tsx    상태 연결: Game/SoundSystem 생성, localStorage 설정, 당첨번호 로딩
scripts/update-draws.mjs   빌드 시 당첨번호 JSON 갱신 (Node)
legacy/        React 이전 단일 페이지 버전. .gitignore 대상 (로컬에만 있을 수 있음). 수정하지 않는다.
```

### 게임 ↔ React 데이터 흐름
- `Game` 은 `useMemo` 로 한 번만 만든다. 매 프레임 상태를 React state 로 옮기지 않는다 (60fps 재렌더 금지).
- 엔진 → React: `GameEvents.onChange(Snapshot)` 은 `update()` 끝에서 호출되지만, 스냅샷 JSON 이 바뀔 때만 실제로 나간다.
  번호판·버튼에 보여야 할 값이 생기면 `Snapshot` 에 넣는다.
- `onFinish(main, bonus)` → App 이 history 에 추가. App 쪽 최신 state 를 쓰려고 `onFinishRef` 로 넘긴다.
- React → 엔진: 메서드 호출 (`fire`, `setAuto`, `reset`) 또는 필드 대입 (`game.theme`).
- 생성자에서는 이벤트를 보내지 않는다 (`init()` vs `reset()`). React 렌더 중 setState 를 피하기 위함.
- 지연 실행은 `this.later()` 로 — `reset()` 때 일괄 취소된다. `setTimeout` 을 엔진에서 직접 쓰지 말 것.

### 게임 규칙상 지켜야 할 것
- 번호 추첨은 풍선이 터질 때 `cryptoInt(pool.length)` 로 정한다. 조준 실력·바람·풍선 색과 무관해야 한다 (공정성).
- 빗나간 화살은 발사 횟수에 포함되지 않는다: `shotsUsed = drawn.length + (busy ? 1 : 0)`.
- 맞힘 판정과 그리기 모두 `balloonX(b)` (흔들림 포함 x) 를 쓴다.
- 좌표는 논리 크기 800×480 (`W`, `H`) 기준. 캔버스 실제 해상도는 Stage 가 DPR 에 맞춰 바꾸고 render 가 setTransform 으로 맞춘다.
- 궁수 스프라이트 `src/assets/archer-sprite.png` 는 234×216 8프레임: 0 대기, 1 화살 걸기, 2 끝까지 당김, 3 조준, 4 환호, 5 발사, 6 미소, 7 활 내림.

## 당첨번호 (중요한 함정)

- 데이터 원본: `public/data/draws.json` = `{ latest, draws: Row[] }`, 회차 오름차순.
  `Row = [회차, "YYYY-MM-DD", n1..n6, 보너스, 1등 당첨자 수, 1등 1인당 당첨금, 2등 당첨자 수, 2등 1인당 당첨금]`.
  형식을 바꾸면 `scripts/update-draws.mjs`(`ROW_LENGTH`) 와 `src/lotto/draws.ts` 를 함께 고친다. 스크립트는 칸 수가 `ROW_LENGTH` 와 다른 줄을 다시 받는다.
- 앱은 JSON 다음 회차만 API 로 받아 `localStorage["lottoDrawsExtra"]` 에 보관한다. 재확인 간격 30분 (`lottoDrawsCheckedAt`).
- API: `https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do` — 동행복권 결과 페이지 내부용, 공식 공개 API 아님.
  - 예전 `common.do?method=getLottoNumber` 는 홈으로 302 리다이렉트되어 더 이상 못 쓴다.
  - 응답의 `Access-Control-Allow-Origin` 이 요청 Origin 을 그대로 돌려주므로 브라우저에서 직접 호출 가능.
  - **헤더를 추가하지 말 것.** 커스텀 헤더 → preflight(OPTIONS) → 400 으로 실패한다. 기본 `fetch(url)` 만.
  - `srchDir=center&srchLtEpsd=N` → N 주변 10개 (N 보다 뒤 회차 3~4개 포함). N 이 아직 없는 회차면 빈 배열.
  - `srchDir=older&srchCursorLtEpsd=N` → N-1 부터 아래로 10개. `srchDir=latest` 는 cursor 위로 10개.
  - 최신 회차를 바로 알려주는 엔드포인트는 없다 → 날짜로 회차를 어림한다 (1회 = 2002-12-07 20:45 KST, 매주 토요일).
- 등수: 1등 6개 / 2등 5개+보너스 / 3등 5개 / 4등 4개 / 5등 3개. 게임의 7번째(보너스) 공은 채점에 쓰지 않는다.

## 역대 1·2등 축하 연출

- 게임이 끝나면 App 의 `onFinishRef` 가 `findPastWins(main, draws)` 로 전체 회차를 검사한다.
  1·2등이 있으면 `game.celebrate(rank)`(캔버스: 금색 폭죽·배너·번쩍임·`jackpot` 효과음) → `JACKPOT_DELAY_MS` 뒤 `<Jackpot>` 축하 창.
- History 는 각 기록에 대해 같은 검사를 해서 🏆 배지와 금색 테두리를 붙인다.
- 실제로는 아주 드물다 (1·2등 합쳐 약 0.1%). 확인은 개발 서버에서 번호를 고정해서 한다:
  `http://localhost:5173/?rig=1246` (그 회차 1등 번호), `?rig=1100&rank=2` (2등 번호).
  `forcedNumbers` 는 `import.meta.env.DEV` 일 때만 설정되므로 배포본에는 영향이 없다.

## 저장소 (localStorage)

키는 `src/storage.ts` 의 `STORAGE_KEYS`. `lottoArcherHist` / `lottoArcherSound` 는 legacy 버전과 같은 키·형식이다.
history 항목 `{ g, main, bonus }` 형식을 바꾸면 기존 사용자 데이터가 깨지니 읽을 때 호환 처리를 한다.
localStorage 접근은 항상 `readStored` / `writeStored` (예외 허용) 를 쓴다.

## 스타일·코드 규칙

- UI 문구와 코드 주석은 한국어. 존댓말 해요체 ("~해요").
- CSS 는 `src/styles.css` 하나. 색은 `:root` 변수, 밤 테마는 `:root[data-theme="night"]` 에서 변수만 바꾼다.
  카드(`.card`) 는 테마와 무관하게 밝은 종이 배경.
- 캔버스 색은 `config.ts` 의 `PALETTE.day / PALETTE.night`.
- 공 색은 실제 로또와 같다: `util.ts` 의 `BALL_RANGES` 한 곳에서만 정의.
- 소리는 `SoundSystem.sfx` 에 함수를 추가하고 `sound.play("이름")` 으로 부른다. 오디오는 첫 사용자 입력 후에만 켜진다 (`unlock`).
- 새 의존성은 꼭 필요할 때만. 런타임 의존성은 react, react-dom 뿐이다.

## 배포

`dist/` 를 정적 호스팅에 올린다. `file://` 로 열면 동작하지 않는다 (ES 모듈·서비스워커).
PWA 는 `registerType: "autoUpdate"` — 새 빌드를 올리면 다음 방문 때 자동 교체된다.
