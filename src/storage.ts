// localStorage 는 사생활 보호 모드 등에서 막혀 있을 수 있으므로 항상 실패를 허용한다.

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 실패는 무시 */
  }
}

export const STORAGE_KEYS = {
  history: "lottoArcherHist",
  sound: "lottoArcherSound",
  theme: "lottoArcherTheme",
} as const;
