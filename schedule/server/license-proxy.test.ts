import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyLicense } from "./license-proxy";

afterEach(() => {
  vi.unstubAllGlobals();
});

const gumroad = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("verifyLicense", () => {
  it("空キーは常に無効", async () => {
    const r = await verifyLicense("", "prod-id");
    expect(r.valid).toBe(false);
    expect(r.status).toBe(400);
  });

  it("製品ID未設定時は絶対にvalid:trueを返さない", async () => {
    const r = await verifyLicense("SOME-KEY", undefined);
    expect(r.valid).toBe(false);
    expect(r.status).toBe(503);
  });

  it("Gumroadが成功を返せば有効", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(gumroad({ success: true, purchase: {} })));
    const r = await verifyLicense("GOOD-KEY", "prod-id");
    expect(r.valid).toBe(true);
  });

  it("返金済みの購入は無効扱い", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(gumroad({ success: true, purchase: { refunded: true } })),
    );
    const r = await verifyLicense("REFUNDED-KEY", "prod-id");
    expect(r.valid).toBe(false);
  });

  it("係争中の購入は無効扱い", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(gumroad({ success: true, purchase: { disputed: true } })),
    );
    const r = await verifyLicense("DISPUTED-KEY", "prod-id");
    expect(r.valid).toBe(false);
  });

  it("Gumroadが失敗を返せば無効", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(gumroad({ success: false }, 404)));
    const r = await verifyLicense("BAD-KEY", "prod-id");
    expect(r.valid).toBe(false);
  });

  it("通信エラー時も無効扱い（fail-close）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const r = await verifyLicense("ANY-KEY", "prod-id");
    expect(r.valid).toBe(false);
    expect(r.status).toBe(502);
  });
});
