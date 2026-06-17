// アプリ設定の永続化（localStorage）。秘密情報は保存しない（GoogleクライアントIDは公開値）。
import type { IcsSource } from "../calendar/ics";
import type { EventTemplate } from "../types";

export interface AppSettings {
  googleClientId: string; // 公開OAuthクライアントID（秘密鍵ではない）
  defaultCalendarId: string; // 既定の書き込み先カレンダー
  defaultDurationMin: number; // 終了時刻未指定時の所要時間
  preferLLM: boolean; // WebGPU利用可能時に端末内LLMを使うか
  icsSources: IcsSource[]; // 統合閲覧する外部カレンダー(ICS購読URL)
  templates: EventTemplate[]; // よく使う予定テンプレ
  defaultReminderMin: number; // 既定の通知（分前）。0で通知なし
}

const STORAGE_KEY = "sukatto.settings.v1";

// 既定のGoogle OAuth クライアントID（公開値）。
// このアプリは個人用のため、入力ミス（typo）を完全に避けるためコードに直接埋め込む。
// 必要に応じて設定画面から上書き可能。
const DEFAULT_GOOGLE_CLIENT_ID =
  "253285776182-7m3pqgmrah6b6g3m2l054o39iiktp5dq.apps.googleusercontent.com";

// 初回に編集/削除可能なサンプルテンプレを用意（毎日の入力短縮の体験を即提供）
const DEFAULT_TEMPLATES: EventTemplate[] = [
  { id: "tpl-work", label: "出勤", title: "出勤", allDay: false, startTime: "09:00", durationMin: 540 },
  { id: "tpl-gym", label: "ジム", title: "ジム", allDay: false, startTime: "19:00", durationMin: 60 },
  { id: "tpl-off", label: "休み", title: "休み", allDay: true },
];

const DEFAULTS: AppSettings = {
  googleClientId: DEFAULT_GOOGLE_CLIENT_ID,
  defaultCalendarId: "primary",
  defaultDurationMin: 60,
  preferLLM: true,
  icsSources: [],
  templates: DEFAULT_TEMPLATES,
  defaultReminderMin: 30,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    // クライアントIDは常に正しい既定値を強制（過去にtypoで保存された誤値を自動補正）。
    // 個人用・単一クライアントのため上書きせず固定する。
    return { ...DEFAULTS, ...parsed, googleClientId: DEFAULT_GOOGLE_CLIENT_ID };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
