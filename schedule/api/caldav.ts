// 本番(Vercel Function)用のCalDAV中継。POST /api/caldav {method,url,headers,auth,body}
// package.jsonが "type":"module" のため、Node ESMは拡張子なし相対importを解決しない。
// よってこの関数は外部importを持たず自己完結させる（dev側は vite.config が
// server/caldav-proxy.ts を使用）。宛先は *.icloud.com に限定し資格情報を保護する。

const MAX_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 4;

const ALLOWED_METHODS = new Set(["GET", "PUT", "DELETE", "PROPFIND", "REPORT", "MKCALENDAR"]);

function isAllowedCaldavHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "icloud.com" || h.endsWith(".icloud.com");
}

function basicAuth(user: string, pass: string): string {
  const raw = `${user}:${pass}`;
  if (typeof Buffer !== "undefined") return `Basic ${Buffer.from(raw, "utf-8").toString("base64")}`;
  return `Basic ${btoa(unescape(encodeURIComponent(raw)))}`;
}

interface ProxyReq {
  method: string;
  url: string;
  headers?: Record<string, string>;
  auth?: { user: string; pass: string };
  body?: string;
}
interface ProxyResult {
  ok: boolean;
  status: number;
  body: string;
  etag?: string;
  error?: string;
}

async function forwardCaldav(reqInput: ProxyReq): Promise<ProxyResult> {
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
    const resp = lastResp as Response;
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return { ok: false, status: 413, body: "", error: "応答が大きすぎます" };
    }
    const text = new TextDecoder("utf-8").decode(buf);
    const etag = resp.headers.get("etag") ?? undefined;
    const ok = resp.status >= 200 && resp.status < 300;
    return { ok, status: resp.status, body: text, etag };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "中継に失敗しました";
    return { ok: false, status: 502, body: "", error: msg };
  } finally {
    clearTimeout(timer);
  }
}

interface MinimalReq {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}
interface MinimalRes {
  status: (code: number) => MinimalRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

function firstHeader(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// 他サイトのブラウザからの踏み台利用を防ぐ。Origin付きリクエストは自ホスト発のみ許可
// （Origin無し=同一オリジンGET/非ブラウザは許容。curl等は元より防御対象外）。
function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin) return true;
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export default async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if ((req.method || "").toUpperCase() !== "POST") {
    res.status(405).json({ error: "POSTのみ受け付けます" });
    return;
  }
  if (!isSameOrigin(firstHeader(req.headers?.origin), firstHeader(req.headers?.host))) {
    res.status(403).json({ error: "許可されないオリジンです" });
    return;
  }
  let payload: ProxyReq;
  try {
    payload = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as ProxyReq;
  } catch {
    res.status(400).json({ error: "リクエストボディが不正です" });
    return;
  }
  const result = await forwardCaldav(payload);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(result);
}
