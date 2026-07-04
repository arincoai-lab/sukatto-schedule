// 本番(Vercel Function)ハンドラのテスト用に res の最小モックを提供する。
// 注意: api/ 配下はVercelが全ファイルをFunction化するため、テスト補助は server/ に置く。

export interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  status: (code: number) => MockRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  send: (body: string) => void;
}

export function mockRes(): MockRes {
  const r: MockRes = {
    statusCode: 0,
    headers: {},
    body: undefined,
    status(code: number) {
      r.statusCode = code;
      return r;
    },
    setHeader(name: string, value: string) {
      r.headers[name] = value;
    },
    json(body: unknown) {
      r.body = body;
    },
    send(body: string) {
      r.body = body;
    },
  };
  return r;
}
