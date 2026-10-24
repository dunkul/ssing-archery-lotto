// 당첨번호 불러오기: 빌드(CI) 때 저장한 data/draws.json 만 쓴다.
// 동행복권 서버에 부하를 주지 않도록 방문자 브라우저는 평소 API 를 부르지 않는다.
// JSON 이 2회차 이상 뒤처졌을 때(= 자동 빌드가 일주일 넘게 실패)만 브라우저당 하루 한 번 비상으로 받아 온다.
import { readStored, writeStored } from "../storage";

export interface Draw {
  round: number;
  date: string;
  numbers: number[];
  bonus: number;
  firstWinners: number;
  firstPrize: number;
  secondWinners: number;
  secondPrize: number;
}

/** draws.json 한 줄: [회차, 추첨일, 번호1..6, 보너스, 1등 당첨자 수, 1등 1인당 당첨금, 2등 당첨자 수, 2등 1인당 당첨금] */
type Row = [number, string, number, number, number, number, number, number, number, number, number, number, number];

interface ApiItem {
  ltEpsd: number;
  ltRflYmd: string | number;
  tm1WnNo: number;
  tm2WnNo: number;
  tm3WnNo: number;
  tm4WnNo: number;
  tm5WnNo: number;
  tm6WnNo: number;
  bnsWnNo: number;
  rnk1WnNope: number;
  rnk1WnAmt: number;
  rnk2WnNope: number;
  rnk2WnAmt: number;
}

// 동행복권 결과 페이지가 쓰는 엔드포인트. 요청한 Origin 을 허용해 주므로 브라우저에서 바로 부를 수 있다.
// 단, 헤더를 추가하면 preflight 요청이 400 으로 거절되니 기본 GET 그대로 호출해야 한다.
const API = "https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do";
const EXTRA_KEY = "lottoDrawsExtra";
const CHECKED_KEY = "lottoDrawsCheckedAt";
/** 비상 조회: 이만큼 회차가 뒤처졌을 때만, 브라우저당 이 간격으로 */
const EMERGENCY_LAG = 2;
const RECHECK_MS = 24 * 3600 * 1000;

const FIRST_DRAW = Date.UTC(2002, 11, 7, 11, 45); // 1회 추첨: 2002-12-07 20:45 KST
const WEEK = 7 * 24 * 3600 * 1000;
/** 추첨 후 결과가 올라오기까지 여유 시간 */
const PUBLISH_DELAY = 30 * 60 * 1000;

const DAY = 24 * 3600 * 1000;

/** 추첨 직후엔 번호만 나오고 당첨자·당첨금은 아직 0 이다 (집계 중).
 *  5회처럼 실제로 1·2등이 모두 없던 옛 회차와 구별하려고 최근 30일 안의 회차만 집계 중으로 본다 */
export const isPending = (d: Draw, now = Date.now()) =>
  !(d.firstWinners || d.firstPrize || d.secondWinners || d.secondPrize) && now - Date.parse(d.date) < 30 * DAY;

/** 지금 시점에 결과가 나와 있어야 할 마지막 회차 */
export const expectedLatestRound = (now = Date.now()) => Math.floor((now - FIRST_DRAW - PUBLISH_DELAY) / WEEK) + 1;

const fromRow = (r: Row): Draw => ({
  round: r[0],
  date: r[1],
  numbers: r.slice(2, 8) as number[],
  bonus: r[8],
  firstWinners: r[9],
  firstPrize: r[10],
  secondWinners: r[11],
  secondPrize: r[12],
});

const fromApi = (x: ApiItem): Draw => {
  const d = String(x.ltRflYmd);
  return {
    round: x.ltEpsd,
    date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
    numbers: [x.tm1WnNo, x.tm2WnNo, x.tm3WnNo, x.tm4WnNo, x.tm5WnNo, x.tm6WnNo],
    bonus: x.bnsWnNo,
    firstWinners: x.rnk1WnNope,
    firstPrize: x.rnk1WnAmt,
    secondWinners: x.rnk2WnNope,
    secondPrize: x.rnk2WnAmt,
  };
};

async function fetchFromApi(aroundRound: number): Promise<Draw[]> {
  const res = await fetch(`${API}?srchDir=center&srchLtEpsd=${aroundRound}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list: ApiItem[] = (await res.json())?.data?.list ?? [];
  return list.map(fromApi);
}

export interface DrawsResult {
  /** 회차 → 당첨번호 */
  draws: Map<number, Draw>;
  latest: number;
  /** 최신 회차를 받아오려 했지만 실패했을 때 */
  stale: boolean;
}

export async function loadDraws(): Promise<DrawsResult> {
  const draws = new Map<number, Draw>();
  const res = await fetch(`${import.meta.env.BASE_URL}data/draws.json`);
  const json: { draws: Row[] } = await res.json();
  for (const r of json.draws) draws.set(r[0], fromRow(r));
  for (const d of readStored<Draw[]>(EXTRA_KEY, [])) draws.set(d.round, d);

  let latest = Math.max(...draws.keys());
  let stale = false;
  const expected = expectedLatestRound();
  const checkedAt = readStored<number>(CHECKED_KEY, 0);

  // 집계 중인 당첨금이나 한 회차 뒤처진 것은 다음 자동 빌드가 채운다. 여기서는 비상시에만 부른다
  if (expected - latest >= EMERGENCY_LAG && Date.now() - checkedAt > RECHECK_MS) {
    // 응답 전에 먼저 기록: 동시에 여러 번 불리거나 실패해도 하루 한 번을 넘지 않게
    writeStored(CHECKED_KEY, Date.now());
    try {
      // center 조회는 요청 회차보다 3~4회 뒤까지 함께 돌려준다
      const from = latest + 1;
      const fresh = (await fetchFromApi(from)).filter((d) => d.round >= from);
      if (fresh.length) {
        for (const d of fresh) draws.set(d.round, d);
        const known = new Set(json.draws.map((r) => r[0]));
        writeStored(
          EXTRA_KEY,
          [...draws.values()].filter((d) => !known.has(d.round)),
        );
        latest = Math.max(...draws.keys());
      }
    } catch {
      stale = true;
    }
  }
  return { draws, latest, stale: stale || expected > latest };
}
