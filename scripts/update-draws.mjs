// 동행복권 당첨번호를 public/data/draws.json 에 저장한다. 이미 있는 회차는 건너뛰고 없는 회차만 받는다.
// 실행: npm run update-draws  (npm run build 전에 자동 실행)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "data", "draws.json");
const API = "https://www.dhlottery.co.kr/lt645/selectPstLt645InfoNew.do";
const FIRST_DRAW = Date.UTC(2002, 11, 7, 11, 45); // 1회 추첨: 2002-12-07 20:45 KST
const WEEK = 7 * 24 * 3600 * 1000;
const DELAY_MS = 150;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// [회차, 추첨일, 번호1..6, 보너스, 1등 당첨자 수, 1등 1인당 당첨금, 2등 당첨자 수, 2등 1인당 당첨금]
const ROW_LENGTH = 13;
const toRow = (x) => {
  const d = String(x.ltRflYmd);
  return [
    x.ltEpsd,
    `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
    x.tm1WnNo, x.tm2WnNo, x.tm3WnNo, x.tm4WnNo, x.tm5WnNo, x.tm6WnNo,
    x.bnsWnNo,
    x.rnk1WnNope,
    x.rnk1WnAmt,
    x.rnk2WnNope,
    x.rnk2WnAmt,
  ];
};

async function query(params) {
  const res = await fetch(`${API}?${new URLSearchParams(params)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json())?.data?.list ?? [];
}

async function load() {
  try {
    return JSON.parse(await readFile(OUT, "utf8")).draws;
  } catch {
    return [];
  }
}

async function main() {
  // 예전 형식(칸이 모자란) 줄은 다시 받는다
  const rows = new Map((await load()).filter((r) => r.length === ROW_LENGTH).map((r) => [r[0], r]));
  const before = rows.size;

  // 최신 회차: 날짜로 어림한 회차 근처를 조회 (center 조회는 요청 회차보다 3~4회 뒤까지 함께 돌려준다)
  const est = Math.floor((Date.now() - FIRST_DRAW) / WEEK) + 1;
  const around = await query({ srchDir: "center", srchLtEpsd: Math.max(1, est - 2) });
  if (!around.length) throw new Error(`최신 회차를 찾지 못했어요 (추정 ${est}회)`);
  for (const x of around) rows.set(x.ltEpsd, toRow(x));
  const latest = Math.max(...around.map((x) => x.ltEpsd));

  // 빠진 회차를 위에서부터 채운다. older 조회는 cursor 바로 아래 10개 회차를 돌려준다.
  for (let r = latest; r >= 1; r--) {
    if (rows.has(r)) continue;
    await sleep(DELAY_MS);
    const list = await query({ srchDir: "older", srchCursorLtEpsd: r + 1 });
    if (!list.length) throw new Error(`${r}회 조회 실패`);
    for (const x of list) rows.set(x.ltEpsd, toRow(x));
    process.stdout.write(`\r${r}회까지 받음   `);
  }

  const draws = [...rows.values()].sort((a, b) => a[0] - b[0]);
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ latest, draws }).replace(/\],\[/g, "],\n["));
  console.log(`\n${draws.length}개 회차 저장 (새로 ${draws.length - before}개, 최신 ${latest}회) → ${path.relative(ROOT, OUT)}`);
}

main().catch(async (e) => {
  console.error("\n당첨번호 업데이트 실패:", e.message);
  // 네트워크가 없어도 기존 파일이 있으면 빌드는 계속되도록 성공으로 끝낸다
  process.exit((await load()).length ? 0 : 1);
});
