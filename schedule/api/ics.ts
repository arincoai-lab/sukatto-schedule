import { fetchIcs } from "../server/ics-proxy";

// 本番(Vercel Function)用のICSプロキシ。GET /api/ics?url=<ICSのURL>
// Node ランタイムの最小シグネチャ（@vercel/node 依存を避けるため構造的に型付け）。

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
