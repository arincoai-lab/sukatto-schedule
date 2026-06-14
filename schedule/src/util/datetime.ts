// 表示用の日時フォーマット（日本語・JST前提）。

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatRange(start: string, end: string | undefined, allDay: boolean): string {
  if (allDay) return `${formatDateLabel(start)} 終日`;
  const s = `${formatDateLabel(start)} ${formatTime(start)}`;
  if (!end) return s;
  // 同日なら終了は時刻のみ
  if (start.slice(0, 10) === end.slice(0, 10)) return `${s}–${formatTime(end)}`;
  return `${s} – ${formatDateLabel(end)} ${formatTime(end)}`;
}

// <input type="datetime-local"> 用の値（ローカル時刻、秒なし）に変換
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// datetime-local の値をJSTのISO文字列へ
export function localInputToIso(local: string): string {
  if (!local) return "";
  // local は "YYYY-MM-DDTHH:mm"。JSTオフセットを付与。
  return `${local}:00+09:00`;
}

export function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}
