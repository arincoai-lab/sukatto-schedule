import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  REVERIFY_INTERVAL_MS,
  isRevalidationDue,
  loadLicense,
  revalidateProLicense,
  saveLicense,
} from "./license";

// node環境にはlocalStorageが無いためMapで代用
function mockStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, String(v));
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const licenseResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
  vi.stubGlobal("localStorage", mockStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isRevalidationDue", () => {
  it("間隔内はfalse・超過でtrue", () => {
    const t0 = 1_000_000;
    expect(isRevalidationDue(t0, t0 + REVERIFY_INTERVAL_MS - 1)).toBe(false);
    expect(isRevalidationDue(t0, t0 + REVERIFY_INTERVAL_MS)).toBe(true);
  });
});

describe("revalidateProLicense", () => {
  it("キー未保存（機能導入前の解除者）は通信せず維持", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await revalidateProLicense()).toBe("keep");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("間隔内は通信せず維持", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const now = Date.now();
    saveLicense("KEY", now - 1000);
    expect(await revalidateProLicense(now)).toBe("keep");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("期限超過＋サーバー有効 → verifiedAtを更新して維持", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(licenseResp({ valid: true })));
    const now = Date.now();
    saveLicense("KEY", now - REVERIFY_INTERVAL_MS - 1);
    expect(await revalidateProLicense(now)).toBe("valid");
    expect(loadLicense()?.verifiedAt).toBe(now);
  });

  it("期限超過＋サーバーが明確に無効(200) → キー破棄してrevoke", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(licenseResp({ valid: false, error: "無効" })),
    );
    const now = Date.now();
    saveLicense("REFUNDED", now - REVERIFY_INTERVAL_MS - 1);
    expect(await revalidateProLicense(now)).toBe("revoke");
    expect(loadLicense()).toBeNull();
  });

  it("期限超過＋通信断 → 失効させず維持（fail-open）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const now = Date.now();
    saveLicense("KEY", now - REVERIFY_INTERVAL_MS - 1);
    expect(await revalidateProLicense(now)).toBe("keep");
    expect(loadLicense()?.key).toBe("KEY");
  });

  it("期限超過＋サーバー未設定(503) → 失効させず維持", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(licenseResp({ valid: false, error: "準備中" }, 503)),
    );
    const now = Date.now();
    saveLicense("KEY", now - REVERIFY_INTERVAL_MS - 1);
    expect(await revalidateProLicense(now)).toBe("keep");
    expect(loadLicense()?.key).toBe("KEY");
  });
});
