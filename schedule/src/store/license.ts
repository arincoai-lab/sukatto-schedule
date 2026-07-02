// 買い切りProライセンスキーの端末保存と定期再検証。
// 目的: 返金・係争後にProが永続する問題への対策（クライアント側のベストエフォート）。
// 方針: fail-open = サーバーが明確に「無効」と答えた時だけ失効させる。
// ネットワーク断・サーバー未設定(503)・Gumroad障害(502)ではProを維持し、
// オフライン利用者や一時障害でユーザーを罰しない。
import { verifyLicense } from "./pro";

const STORAGE_KEY = "sukatto.license.v1";

/** 再検証の間隔。前回検証からこの時間を超えた起動時にサーバーへ確認する。 */
export const REVERIFY_INTERVAL_MS = 7 * 86_400_000; // 7日

export interface StoredLicense {
  key: string; // 購入者のライセンスキー
  verifiedAt: number; // 最後に検証が成功した時刻(epoch ms)
}

export function loadLicense(): StoredLicense | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLicense>;
    if (typeof parsed.key !== "string" || !parsed.key) return null;
    return { key: parsed.key, verifiedAt: Number(parsed.verifiedAt) || 0 };
  } catch {
    return null;
  }
}

export function saveLicense(key: string, verifiedAt: number = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, verifiedAt }));
  } catch {
    /* 保存失敗は無視（最悪、次回起動時に再検証されるだけ） */
  }
}

export function clearLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** 前回検証から再検証間隔を超えているか。 */
export function isRevalidationDue(verifiedAt: number, now: number = Date.now()): boolean {
  return now - verifiedAt >= REVERIFY_INTERVAL_MS;
}

export type RevalidateOutcome = "valid" | "revoke" | "keep";

/**
 * 保存済みライセンスを必要に応じて再検証する。
 * - キー未保存（この機能の導入前に解除したユーザー）は現状維持
 * - 間隔内なら通信せず維持
 * - サーバーが明確に無効と回答 → キーを破棄して "revoke"（呼び出し側でisProを落とす）
 * - 通信断・サーバー都合の失敗 → "keep"（fail-open）
 */
export async function revalidateProLicense(now: number = Date.now()): Promise<RevalidateOutcome> {
  const stored = loadLicense();
  if (!stored) return "keep";
  if (!isRevalidationDue(stored.verifiedAt, now)) return "keep";
  const result = await verifyLicense(stored.key);
  if (result.valid) {
    saveLicense(stored.key, now);
    return "valid";
  }
  if (result.definitive) {
    clearLicense();
    return "revoke";
  }
  return "keep";
}
