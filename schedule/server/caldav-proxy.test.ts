import { afterEach, describe, expect, it, vi } from "vitest";
import { forwardCaldav, isAllowedCaldavHost } from "./caldav-proxy";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isAllowedCaldavHost", () => {
  it.each(["icloud.com", "caldav.icloud.com", "p12-caldav.icloud.com", "P12-CALDAV.ICLOUD.COM"])(
    "%s を許可する",
    (h) => {
      expect(isAllowedCaldavHost(h)).toBe(true);
    },
  );

  it.each(["evil.com", "icloud.com.evil.com", "noticloud.com", "xicloud.com", "icloud.co"])(
    "%s を拒否する",
    (h) => {
      expect(isAllowedCaldavHost(h)).toBe(false);
    },
  );
});

describe("forwardCaldav", () => {
  it("許可外メソッドを405で拒否する", async () => {
    const r = await forwardCaldav({ method: "POST", url: "https://caldav.icloud.com/" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(405);
  });

  it("httpのURLを拒否する", async () => {
    const r = await forwardCaldav({ method: "GET", url: "http://caldav.icloud.com/" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("iCloud以外のホストを403で拒否する", async () => {
    const r = await forwardCaldav({ method: "GET", url: "https://example.com/" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  it("iCloud外へのリダイレクトを502で拒否する", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "https://evil.com/steal" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await forwardCaldav({
      method: "GET",
      url: "https://caldav.icloud.com/x",
      auth: { user: "u", pass: "p" },
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("iCloud内のリダイレクトは追従しBasic認証を付け直す", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { location: "https://p12-caldav.icloud.com/y" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await forwardCaldav({
      method: "GET",
      url: "https://caldav.icloud.com/x",
      auth: { user: "u", pass: "p" },
    });
    expect(r.ok).toBe(true);
    expect(r.body).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCall = fetchMock.mock.calls[1] as [string, { headers: Record<string, string> }];
    expect(secondCall[0]).toBe("https://p12-caldav.icloud.com/y");
    expect(secondCall[1].headers.Authorization).toMatch(/^Basic /);
  });
});
