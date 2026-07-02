// 本番Function api/caldav.ts のハンドラレベルのテスト（Originチェック・中継ガード）。
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/caldav";
import { mockRes } from "./test-helpers";

afterEach(() => {
  vi.unstubAllGlobals();
});

const HOST = "app.sukatto.rt-ai-lab.com";

function req(body: unknown, headers: Record<string, string> = {}, method = "POST") {
  return { method, body, headers: { host: HOST, ...headers } };
}

describe("api/caldav handler", () => {
  it("POST以外は405", async () => {
    const res = mockRes();
    await handler(req({}, {}, "GET"), res);
    expect(res.statusCode).toBe(405);
  });

  it("Originが自ホストと不一致なら403", async () => {
    const res = mockRes();
    await handler(
      req(
        { method: "GET", url: "https://caldav.icloud.com/" },
        { origin: "https://evil.example" },
      ),
      res,
    );
    expect(res.statusCode).toBe(403);
  });

  it("Originが自ホストと一致すれば中継する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));
    const res = mockRes();
    await handler(
      req(
        { method: "GET", url: "https://caldav.icloud.com/x" },
        { origin: `https://${HOST}` },
      ),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);
  });

  it("iCloud以外のホストは中継しない（bodyのstatus=403）", async () => {
    const res = mockRes();
    await handler(req({ method: "GET", url: "https://example.com/" }), res);
    expect(res.statusCode).toBe(200); // 中継結果はbodyに包む設計
    expect((res.body as { status: number }).status).toBe(403);
  });

  it("許可外メソッドは中継しない（bodyのstatus=405）", async () => {
    const res = mockRes();
    await handler(req({ method: "POST", url: "https://caldav.icloud.com/" }), res);
    expect((res.body as { status: number }).status).toBe(405);
  });

  it("不正なJSON文字列ボディは400", async () => {
    const res = mockRes();
    await handler(req("{not-json"), res);
    expect(res.statusCode).toBe(400);
  });
});
