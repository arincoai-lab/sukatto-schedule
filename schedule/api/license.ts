// 本番(Vercel Function)用の買い切りライセンス検証。POST /api/license {licenseKey}
// package.jsonが "type":"module" のため、Node ESMは拡張子なし相対importを解決しない。
// よってこの関数は外部importを持たず自己完結させる（dev側は vite.config が
// server/license-proxy.ts を使用）。製品IDは環境変数 GUMROAD_PRODUCT_ID で保持し、
// クライアントには出さない。キーが無効なら絶対に valid:true を返さない。

const TIMEOUT_MS = 8000;
const GUMROAD_VERIFY_URL = "https://api.gumroad.com/v2/licenses/verify";

interface VerifyResult {
  ok: boolean;
  status: number;
  valid: boolean;
  error?: string;
}

async function verifyLicense(
  licenseKey: string | null | undefined,
  productId: string | undefined,
): Promise<VerifyResult> {
  const key = (licenseKey ?? "").trim();
  if (!key) return { ok: false, status: 400, valid: false, error: "ライセンスキーが必要です" };
  if (!productId) {
    return { ok: false, status: 503, valid: false, error: "ライセンス検証は現在準備中です" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const body = new URLSearchParams({
      product_id: productId,
      license_key: key,
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

interface MinimalReq {
  method?: string;
  body?: unknown;
}
interface MinimalRes {
  status: (code: number) => MinimalRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

export default async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if ((req.method || "").toUpperCase() !== "POST") {
    res.status(405).json({ error: "POSTのみ受け付けます" });
    return;
  }
  let payload: { licenseKey?: string };
  try {
    payload = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as {
      licenseKey?: string;
    };
  } catch {
    res.status(400).json({ error: "リクエストボディが不正です" });
    return;
  }
  const result = await verifyLicense(payload?.licenseKey, process.env.GUMROAD_PRODUCT_ID);
  res.setHeader("Cache-Control", "no-store");
  res.status(result.ok ? 200 : result.status).json({ valid: result.valid, error: result.error });
}
