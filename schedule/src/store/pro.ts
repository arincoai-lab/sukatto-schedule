// 買い切りProの権利判定とフリーミアム上限。
// - 無料: クイック登録テンプレ FREE_TEMPLATE_LIMIT 種類まで / 音声入力 FREE_VOICE_PER_DAY 回/日
// - Pro: 無制限（settings.isPro が true）
// 使用量カウンタは設定とは別キーに保存（リセット容易・設定汚染回避）。

// 無料プランの上限値
export const FREE_TEMPLATE_LIMIT = 5;
export const FREE_VOICE_PER_DAY = 3;

// Pro購入ページ（Gumroad等）。公開URLのため環境変数で差し替え可能。
export const PRO_PURCHASE_URL =
  (import.meta.env.VITE_PRO_PURCHASE_URL as string | undefined) ??
  "https://gumroad.com/";

const USAGE_KEY = "sukatto.usage.v1";

interface VoiceUsage {
  date: string; // "YYYY-MM-DD"（端末ローカル日付）
  count: number;
}

function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function readVoiceUsage(): VoiceUsage {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { date: todayKey(), count: 0 };
    const parsed = JSON.parse(raw) as Partial<VoiceUsage>;
    if (parsed.date !== todayKey()) return { date: todayKey(), count: 0 };
    return { date: todayKey(), count: Math.max(0, Number(parsed.count) || 0) };
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

/** 本日の残り音声回数（Proは Infinity）。 */
export function remainingVoice(isPro: boolean): number {
  if (isPro) return Infinity;
  return Math.max(0, FREE_VOICE_PER_DAY - readVoiceUsage().count);
}

/** 音声入力を開始してよいか（無料は1日3回まで）。 */
export function canUseVoice(isPro: boolean): boolean {
  return remainingVoice(isPro) > 0;
}

/** 音声入力を1回消費として記録（無料時のみ意味を持つ）。 */
export function recordVoiceUse(): void {
  try {
    const usage = readVoiceUsage();
    localStorage.setItem(
      USAGE_KEY,
      JSON.stringify({ date: usage.date, count: usage.count + 1 }),
    );
  } catch {
    /* 保存失敗は無視（最悪カウントされないだけ） */
  }
}

/** テンプレを新規追加してよいか（無料は5種類まで）。 */
export function canAddTemplate(isPro: boolean, currentCount: number): boolean {
  return isPro || currentCount < FREE_TEMPLATE_LIMIT;
}

export interface LicenseResult {
  valid: boolean;
  error?: string;
  /**
   * サーバーが明確に有効/無効を判定したか。
   * false = 通信断・サーバー未設定(503)・Gumroad障害(502)等の不確定状態。
   * 再検証で失効させてよいのは definitive && !valid の時だけ（fail-open）。
   */
  definitive: boolean;
}

/**
 * ライセンスキーを検証してProを解除できるか確認する。
 * 実際の検証は薄いサーバー関数 /api/license が行う（製品IDはサーバー側のみ）。
 * サーバーはGumroadが明確に回答した時のみ HTTP 200 を返す（それ以外は400/502/503）。
 */
export async function verifyLicense(licenseKey: string): Promise<LicenseResult> {
  const key = licenseKey.trim();
  if (!key) return { valid: false, definitive: true, error: "ライセンスキーを入力してください" };
  try {
    const resp = await fetch("/api/license", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey: key }),
    });
    const data = (await resp.json()) as { valid?: boolean; error?: string };
    if (!resp.ok || !data.valid) {
      return {
        valid: false,
        definitive: resp.status === 200,
        error: data.error ?? "ライセンスを確認できませんでした",
      };
    }
    return { valid: true, definitive: true };
  } catch {
    return {
      valid: false,
      definitive: false,
      error: "通信に失敗しました。時間をおいて再度お試しください",
    };
  }
}
