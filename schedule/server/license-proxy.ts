// 買い切りProのライセンス検証コア。dev(Viteミドルウェア)とprod(Vercel Function)で共有。
// GumroadのライセンスAPIを叩くだけの薄い中継。製品ID等はサーバー側の環境変数で保持し、
// クライアントには出さない（アプリの「秘密鍵を持たない」方針をサーバー側でも踏襲）。

const TIMEOUT_MS = 8000;
const GUMROAD_VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify";

export interface LicenseVerifyResult {
  ok: boolean;
  status: number;
  valid: boolean;
  error?: string;
}

/**
 * ライセンスキーを検証する。
 * @param licenseKey 購入者が入力したキー
 * @param productId  Gumroadの product_id（環境変数 GUMROAD_PRODUCT_ID）
 */
export async function verifyLicense(
  licenseKey: string | null | undefined,
  productId: string | undefined,
): Promise<LicenseVerifyResult> {
  const key = (licenseKey ?? "").trim();
  if (!key) {
    return { ok: false, status: 400, valid: false, error: "ライセンスキーが必要です" };
  }
  if (!productId) {
    // サーバー未設定。検証導線が動かない状態を明示（キーは絶対にtrueにしない）。
    return {
      ok: false,
      status: 503,
      valid: false,
      error: "ライセンス検証は現在準備中です",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = new URLSearchParams({
      product_id: productId,
      license_key: key,
      // 検証だけで利用回数は増やさない（複数端末での再検証を許容）。
      increment_uses_count: "false",
    });
    const resp = await fetch(GUMROAD_VERIFY_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await resp.json().catch(() => null)) as
      | { success?: boolean; purchase?: { refunded?: boolean; disputed?: boolean } }
      | null;

    if (!resp.ok || !data?.success) {
      return { ok: true, status: 200, valid: false, error: "ライセンスが無効です" };
    }
    // 返金・係争中の購入は無効扱い。
    if (data.purchase?.refunded || data.purchase?.disputed) {
      return { ok: true, status: 200, valid: false, error: "このライセンスは無効です" };
    }
    return { ok: true, status: 200, valid: true };
  } catch {
    return { ok: false, status: 502, valid: false, error: "検証に失敗しました" };
  } finally {
    clearTimeout(timer);
  }
}
