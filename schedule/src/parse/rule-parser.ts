import * as chrono from "chrono-node";
import type { ParsedEvent, ParseResult, EventSource } from "../types";

// chrono の日本語パーサで日時を抽出し、残りをタイトルとして扱う軽量解析器。
// WebGPU/LLMが使えない端末でも「明日15時 歯医者」級を確実に登録するための下限保証。

const ISO_OFFSET = "+09:00"; // JST固定（PWAは日本ユーザ前提）

function toIso(date: Date): string {
  // ローカル時刻をJSTのISO文字列へ。
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00${ISO_OFFSET}`
  );
}

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 相対週/月の語（chronoのマッチに含まれず取り残されやすい）
const ORPHAN_TEMPORAL = /(先々週|再来週|今週|来週|先週|先々月|再来月|今月|来月|先月)/g;

// 抽出した日時表現と場所を除去してタイトルを作る
function deriveTitle(text: string, matchedText: string, location?: string): string {
  let title = text.replace(matchedText, " ");
  if (location) {
    // @渋谷 / ＠渋谷 / 場所文字列そのものを除去
    title = title.replace(new RegExp(`[@＠]?\\s*${location}`, "g"), " ");
  }
  title = title
    .replace(ORPHAN_TEMPORAL, " ")
    .replace(/[、。,.]/g, " ")
    .replace(/\s+/g, " ")
    // 先頭・末尾に取り残された助詞を除去
    .replace(/^\s*(から|まで|に|は|で|へ|の)\s*/, "")
    .replace(/\s*(から|まで|に|は|で|へ)\s*$/, "")
    .trim();
  return title || "予定";
}

// 「〜で」「@場所」程度の簡易ロケーション抽出
function extractLocation(text: string): string | undefined {
  const at = text.match(/[@＠]\s*([^\s、。]+)/);
  if (at) return at[1];
  const de = text.match(/([^\s、。]{2,})で(?:打ち合わせ|会議|ミーティング|集合|待ち合わせ)/);
  if (de) return de[1];
  return undefined;
}

export function parseWithRules(
  text: string,
  source: EventSource,
  now: Date = new Date(),
  defaultDurationMin = 60,
): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { events: [], engine: "rule", warnings: ["入力が空です"] };
  }

  // 複数行（写真OCR等）は行ごとに解析して複数予定を抽出
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    const multi = lines.flatMap((line) =>
      segmentToEvents(line, source, now, defaultDurationMin),
    );
    if (multi.length > 0) return { events: multi, engine: "rule" };
  }

  const events = segmentToEvents(trimmed, source, now, defaultDurationMin);
  if (events.length > 0) return { events, engine: "rule" };

  // 日時が取れない場合は終日の予定候補として今日を仮置き（確信度低）
  const fallback: ParsedEvent = {
    title: trimmed.slice(0, 80),
    start: toIsoDate(now),
    allDay: true,
    confidence: 0.2,
    source,
    location: extractLocation(trimmed),
  };
  return {
    events: [fallback],
    engine: "rule",
    warnings: ["日時を認識できませんでした。日付を確認してください。"],
  };
}

// 1セグメント（1行 or 全文）から日付付きイベントを抽出。日付が無ければ空配列。
function segmentToEvents(
  text: string,
  source: EventSource,
  now: Date,
  defaultDurationMin: number,
): ParsedEvent[] {
  const results = chrono.ja.parse(text, now, { forwardDate: true });
  const location = extractLocation(text);

  return results.map((r) => {
    const startDate = r.start.date();
    const hasTime = r.start.isCertain("hour");

    if (!hasTime) {
      return {
        title: deriveTitle(text, r.text, location),
        start: toIsoDate(startDate),
        allDay: true,
        confidence: 0.6,
        source,
        location,
      };
    }

    const endIso = r.end
      ? toIso(r.end.date())
      : toIso(new Date(startDate.getTime() + defaultDurationMin * 60_000));

    return {
      title: deriveTitle(text, r.text, location),
      start: toIso(startDate),
      end: endIso,
      allDay: false,
      confidence: 0.75,
      source,
      location,
    };
  });
}
