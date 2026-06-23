// テンプレの時刻計算ヘルパー（"HH:mm" ⇄ 分、終了時刻・所要時間の算出）。

export function timeToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minToTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440; // 0..1439 に正規化
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

// 開始("HH:mm") + 所要(分) → 終了("HH:mm")
export function endTime(start: string, durationMin: number): string {
  return minToTime(timeToMin(start) + durationMin);
}

// 開始・終了("HH:mm") → 所要(分)。終了が開始以前なら翌日跨ぎとみなす（例 22:00→01:00）。
export function durationMinBetween(start: string, end: string): number {
  let d = timeToMin(end) - timeToMin(start);
  if (d <= 0) d += 1440;
  return d;
}
