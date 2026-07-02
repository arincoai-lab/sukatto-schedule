// 本番Function api/ics.ts のハンドラレベルのテスト（Originチェック・SSRFガード）。
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/ics";
import { mockRes } from "./test-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const HOST = "app.sukatto.rt-ai-lab.com";

function req(url: string | undefined, headers: Record<string, string> = {}) {
  return { query: { url }, headers: { host: HOST, ...headers } };
}

describe("api/ics handler", () => {
  it("Originが自ホストと不一致なら403", async () => {
    const res = mockRes();
    await handler(req("https://example.com/cal.ics", { origin: "https://evil.example" }), res);
    expect(res.statusCode).toBe(403);
  });

  it("Originが自ホストと一致すれば通す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("BEGIN:VCALENDAR\nEND:VCALENDAR")),
    );
    const res = mockRes();
    await handler(req("https://example.com/cal.ics", { origin: `https://${HOST}` }), res);
    expect(res.statusCode).toBe(200);
    expect(String(res.body)).toContain("VCALENDAR");
  });

  it("Origin無し（同一オリジンGET/非ブラウザ）は許容する", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("BEGIN:VCALENDAR\nEND:VCALENDAR")),
    );
    const res = mockRes();
    await handler(req("https://example.com/cal.ics"), res);
    expect(res.statusCode).toBe(200);
  });

  it("urlパラメータ無しは400", async () => {
    const res = mockRes();
    await handler(req(undefined), res);
    expect(res.statusCode).toBe(400);
  });

  it.each([
    "https://localhost/x.ics",
    "https://127.0.0.1/x.ics",
    "https://10.0.0.5/x.ics",
    "https://169.254.169.254/latest/meta-data", // クラウドメタデータ
    "https://192.168.1.1/x.ics",
  ])("内部ホスト %s へのSSRFを403で拒否", async (url) => {
    const res = mockRes();
    await handler(req(url), res);
    expect(res.statusCode).toBe(403);
  });

  it("webcal:// は https に読み替えて取得する", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("BEGIN:VCALENDAR\nEND:VCALENDAR"));
    vi.stubGlobal("fetch", fetchMock);
    const res = mockRes();
    await handler(req("webcal://example.com/cal.ics"), res);
    expect(res.statusCode).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/example\.com/);
  });
});
