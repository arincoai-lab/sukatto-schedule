import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchIcs } from "./ics-proxy";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchIcs", () => {
  it("webcal:// を https に読み替えて取得する（URL#protocol代入は仕様上無効）", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("BEGIN:VCALENDAR\nEND:VCALENDAR"));
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchIcs("webcal://example.com/cal.ics");
    expect(r.ok).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/example\.com/);
  });

  it("url無しは400", async () => {
    const r = await fetchIcs(null);
    expect(r.status).toBe(400);
  });

  it.each(["https://localhost/x.ics", "https://169.254.169.254/meta", "https://10.0.0.5/x"])(
    "内部ホスト %s を403で拒否",
    async (url) => {
      const r = await fetchIcs(url);
      expect(r.status).toBe(403);
    },
  );

  it("ftp等の非httpスキームは400", async () => {
    const r = await fetchIcs("ftp://example.com/cal.ics");
    expect(r.status).toBe(400);
  });
});
