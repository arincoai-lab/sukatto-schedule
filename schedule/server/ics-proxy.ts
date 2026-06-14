// ICS取得プロキシのコア。dev(Viteミドルウェア)とprod(Vercel Function)で共有。
// クライアントのCORS制約を回避するためだけの薄いフェッチャ。秘密情報は扱わない。
// 任意URLを取得するためSSRF対策を施す（プライベート/ローカル宛を拒否）。

const MAX_BYTES = 2 * 1024 * 1024; // 2MB上限
const TIMEOUT_MS = 8000;

// 明らかなプライベート/ループバック/メタデータ宛を拒否
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  // IPv4 リテラルの私的範囲
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / metadata 169.254.169.254
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

export interface IcsFetchResult {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}

export async function fetchIcs(rawUrl: string | null): Promise<IcsFetchResult> {
  if (!rawUrl) {
    return { ok: false, status: 400, body: "", error: "url パラメータが必要です" };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, status: 400, body: "", error: "URLが不正です" };
  }

  // webcal:// は https へ読み替え
  if (url.protocol === "webcal:") {
    url.protocol = "https:";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, status: 400, body: "", error: "http/https のみ許可されます" };
  }
  if (isBlockedHost(url.hostname)) {
    return { ok: false, status: 403, body: "", error: "このホストへのアクセスは許可されません" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/calendar, text/plain, */*" },
    });
    if (!resp.ok) {
      return { ok: false, status: resp.status, body: "", error: `取得失敗 (${resp.status})` };
    }
    const text = await resp.text();
    if (text.length > MAX_BYTES) {
      return { ok: false, status: 413, body: "", error: "ICSが大きすぎます" };
    }
    return { ok: true, status: 200, body: text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "取得に失敗しました";
    return { ok: false, status: 502, body: "", error: msg };
  } finally {
    clearTimeout(timer);
  }
}
