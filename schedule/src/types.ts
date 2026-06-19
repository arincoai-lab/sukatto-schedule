// 入力ソース種別
export type EventSource = "voice" | "photo" | "manual";

// アプリのテーマモード（system は端末設定に追従）
export type ThemeMode = "light" | "dark" | "system";

// 解析結果として確認UIに渡す構造化イベント
export interface ParsedEvent {
  title: string;
  start: string; // ISO 8601 (例: 2026-06-14T15:00:00+09:00)
  end?: string; // 無指定なら start + 既定所要時間
  allDay?: boolean;
  location?: string;
  notes?: string;
  confidence: number; // 0..1 解析確信度（確認UIで強調表示に使用）
  source: EventSource;
  reminderMin?: number; // 何分前に通知するか（Googleのreminders.overrides用）。未指定で既定を使用
}

// 解析器の戻り値。複数予定を含む入力にも対応。
export interface ParseResult {
  events: ParsedEvent[];
  // どの解析経路を通ったか（デバッグ/UI表示用）
  engine: "llm" | "rule";
  warnings?: string[];
}

// よく使う予定テンプレ（1タップ＋日付で登録するための雛形）
export interface EventTemplate {
  id: string;
  label: string; // チップ表示名（例: 出勤）
  title: string; // 予定タイトル（例: 出勤）
  allDay: boolean;
  startTime?: string; // "HH:mm"（allDay=false時）
  durationMin?: number; // 所要時間（end算出用）
  location?: string;
}

// アジェンダ表示用イベント。提供元で編集可否が変わる。
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO 8601 または日付(allDay)
  end?: string;
  allDay: boolean;
  location?: string;
  calendarSummary?: string;
  provider: "google" | "ics"; // google=編集/削除可、ics=読み取り専用
  calendarId?: string; // 由来カレンダーID（Google編集/削除時に必要）
}
