// 本番(Vercel Function)用のICSプロキシ。GET /api/ics?url=<ICSのURL>
// package.jsonが "type": "module" のため関数はESMで動作する。Node ESMは拡張子なしの
// 相対importを解決しないため、この関数は外部importを持たず自己完結させる
// （SSRFガード等のロジックを内包）。dev側は vite.config が server/ics-proxy.ts を使用。

const MAX_BYTES = 2 * 1024 * 1024; // 2MB上限
const TIMEOUT_MS = 8000;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / metadata
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

interface IcsFetchResult {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}

async function fetchIcs(rawUrl: string | null): Promise<IcsFetchResult> {
  if (!rawUrl) return { ok: false, status: 400, body: "", error: "url パラメータが必要です" };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, status: 400, body: "", error: "URLが不正です" };
  }

  if (url.protocol === "webcal:") url.protocol = "https:";
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

interface MinimalReq {
  query: Record<string, string | string[] | undefined>;
}
interface MinimalRes {
  status: (code: number) => MinimalRes;
  setHeader: (name: string, value: string) => void;
  send: (body: string) => void;
  json: (body: unknown) => void;
}

export default async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  const q = req.query.url;
  const url = Array.isArray(q) ? q[0] : q ?? null;

  const result = await fetchIcs(url);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=600");
  res.status(200).send(result.body);
}
