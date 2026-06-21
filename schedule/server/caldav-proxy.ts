// CalDAV中継プロキシのコア。dev(Viteミドルウェア)とprod(Vercel Function)で共有。
// ブラウザは CORS と PROPFIND/REPORT 等の特殊メソッドで iCloud へ直接アクセスできないため、
// この薄い中継を経由する。資格情報(Basic)を転送するので、宛先は *.icloud.com に限定する。
//
// iCloud はパーティションリダイレクト(caldav.icloud.com → pXX-caldav.icloud.com)を返す。
// fetch の自動追従はクロスオリジンで Authorization を剥がすため、3xx を手動で辿り、
// 同じ icloud.com 内でのみ Basic 認証を付け直して再送する。

const MAX_BYTES = 4 * 1024 * 1024; // 4MB上限（カレンダー一覧/REPORT想定）
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 4;

// iCloud(CalDAV) のホストのみ許可。資格情報の漏えい防止。
export function isAllowedCaldavHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "icloud.com" || h.endsWith(".icloud.com");
}

export interface CaldavProxyRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  auth?: { user: string; pass: string };
  body?: string;
}

export interface CaldavProxyResult {
  ok: boolean;
  status: number;
  body: string;
  etag?: string;
  error?: string;
}

const ALLOWED_METHODS = new Set([
  "GET",
  "PUT",
  "DELETE",
  "PROPFIND",
  "REPORT",
  "MKCALENDAR",
]);

function basicAuth(user: string, pass: string): string {
  // btoa はバイナリ文字列前提。UTF-8安全になるようエンコードしてから base64 化する。
  const raw = `${user}:${pass}`;
  return `Basic ${btoa(unescape(encodeURIComponent(raw)))}`;
}

export async function forwardCaldav(reqInput: CaldavProxyRequest): Promise<CaldavProxyResult> {
  const method = (reqInput.method || "").toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    return { ok: false, status: 405, body: "", error: `許可されないメソッド: ${method}` };
  }

  let url: URL;
  try {
    url = new URL(reqInput.url);
  } catch {
    return { ok: false, status: 400, body: "", error: "URLが不正です" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, status: 400, body: "", error: "https のみ許可されます" };
  }
  if (!isAllowedCaldavHost(url.hostname)) {
    return { ok: false, status: 403, body: "", error: "iCloud以外のホストへは中継できません" };
  }

  const authHeader = reqInput.auth ? basicAuth(reqInput.auth.user, reqInput.auth.pass) : undefined;
  const baseHeaders: Record<string, string> = { ...(reqInput.headers ?? {}) };
  // クライアント側が誤って付けても上書き。Hostは fetch が管理。
  delete baseHeaders.Host;
  delete baseHeaders.host;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let current = url.toString();
    let lastResp: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const headers: Record<string, string> = { ...baseHeaders };
      if (authHeader) headers.Authorization = authHeader;
      const resp = await fetch(current, {
        method,
        headers,
        body: method === "GET" || method === "DELETE" ? undefined : reqInput.body,
        redirect: "manual",
        signal: controller.signal,
      });
      lastResp = resp;
      // 3xx は手動追従（icloud.com 内のみ・認証を付け直し）
      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, current);
        if (next.protocol !== "https:" || !isAllowedCaldavHost(next.hostname)) {
          return { ok: false, status: 502, body: "", error: "リダイレクト先が不正です" };
        }
        current = next.toString();
        continue;
      }
      break;
    }

    const resp = lastResp!;
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return { ok: false, status: 413, body: "", error: "応答が大きすぎます" };
    }
    const text = new TextDecoder("utf-8").decode(buf);
    const etag = resp.headers.get("etag") ?? undefined;
    // 2xx 系を成功とみなす（207 Multi-Status を含む）
    const ok = resp.status >= 200 && resp.status < 300;
    return { ok, status: resp.status, body: text, etag };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "中継に失敗しました";
    return { ok: false, status: 502, body: "", error: msg };
  } finally {
    clearTimeout(timer);
  }
}
