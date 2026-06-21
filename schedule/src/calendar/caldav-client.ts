// CalDAV 低レベルクライアント。/api/caldav 中継を介して iCloud と通信し、
// XML(multistatus) を解析する。ディスカバリ(principal → calendar-home → カレンダー一覧)
// もここで行う。イベントCRUDは caldav-events.ts。
import type { IcloudCredential } from "./icloud-cred";

export const ICLOUD_ROOT = "https://caldav.icloud.com/";

const DAV_NS = "DAV:";
const CALDAV_NS = "urn:ietf:params:xml:ns:caldav";

export interface CaldavResponse {
  ok: boolean;
  status: number;
  body: string;
  etag?: string;
  error?: string;
}

export interface CaldavCalendar {
  url: string; // コレクションの絶対URL（書き込み/REPORTの宛先）
  displayName: string;
}

interface CaldavRequestInit {
  method: string;
  url: string;
  cred: IcloudCredential;
  headers?: Record<string, string>;
  body?: string;
}

// 中継(/api/caldav)へPOSTし、iCloudの応答(ラップ済みJSON)を返す。
export async function caldavRequest(init: CaldavRequestInit): Promise<CaldavResponse> {
  const resp = await fetch("/api/caldav", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: init.method,
      url: init.url,
      headers: init.headers,
      auth: { user: init.cred.appleId, pass: init.cred.appPassword },
      body: init.body,
    }),
  });
  if (!resp.ok) {
    return { ok: false, status: resp.status, body: "", error: `中継エラー (${resp.status})` };
  }
  return (await resp.json()) as CaldavResponse;
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, "application/xml");
}

function resolveHref(href: string, baseUrl: string): string {
  return new URL(href.trim(), baseUrl).toString();
}

// multistatus の各 <response> から最初の <href> テキストを取り出す
function responseHrefs(doc: Document): Element[] {
  return Array.from(doc.getElementsByTagNameNS(DAV_NS, "response"));
}

function firstHref(el: Element): string | undefined {
  const h = el.getElementsByTagNameNS(DAV_NS, "href")[0];
  return h?.textContent ?? undefined;
}

function authErrorMessage(status: number): string {
  if (status === 401) return "認証に失敗しました。Apple IDとアプリ用パスワードを確認してください。";
  if (status === 403) return "アクセスが拒否されました。アプリ用パスワードの権限を確認してください。";
  return `iCloudへの接続に失敗しました (${status})`;
}

// 1) current-user-principal を取得
async function fetchPrincipalUrl(cred: IcloudCredential): Promise<string> {
  const body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>';
  const res = await caldavRequest({
    method: "PROPFIND",
    url: ICLOUD_ROOT,
    cred,
    headers: { Depth: "0", "Content-Type": "application/xml; charset=utf-8" },
    body,
  });
  if (!res.ok) throw new Error(res.error ?? authErrorMessage(res.status));
  const doc = parseXml(res.body);
  const node = doc.getElementsByTagNameNS(DAV_NS, "current-user-principal")[0];
  const href = node?.getElementsByTagNameNS(DAV_NS, "href")[0]?.textContent;
  if (!href) throw new Error("プリンシパルを取得できませんでした");
  return resolveHref(href, ICLOUD_ROOT);
}

// 2) calendar-home-set を取得
async function fetchCalendarHome(cred: IcloudCredential, principalUrl: string): Promise<string> {
  const body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    "<d:prop><c:calendar-home-set/></d:prop></d:propfind>";
  const res = await caldavRequest({
    method: "PROPFIND",
    url: principalUrl,
    cred,
    headers: { Depth: "0", "Content-Type": "application/xml; charset=utf-8" },
    body,
  });
  if (!res.ok) throw new Error(res.error ?? authErrorMessage(res.status));
  const doc = parseXml(res.body);
  const node = doc.getElementsByTagNameNS(CALDAV_NS, "calendar-home-set")[0];
  const href = node?.getElementsByTagNameNS(DAV_NS, "href")[0]?.textContent;
  if (!href) throw new Error("カレンダーホームを取得できませんでした");
  return resolveHref(href, principalUrl);
}

// このresponseがVEVENT対応のカレンダーコレクションか判定
function isVeventCalendar(resp: Element): boolean {
  const rt = resp.getElementsByTagNameNS(DAV_NS, "resourcetype")[0];
  const isCalendar = rt && rt.getElementsByTagNameNS(CALDAV_NS, "calendar").length > 0;
  if (!isCalendar) return false;
  const compSet = resp.getElementsByTagNameNS(CALDAV_NS, "supported-calendar-component-set")[0];
  if (!compSet) return true; // 宣言が無い場合は許容
  const comps = Array.from(compSet.getElementsByTagNameNS(CALDAV_NS, "comp"));
  if (comps.length === 0) return true;
  return comps.some((c) => (c.getAttribute("name") ?? "").toUpperCase() === "VEVENT");
}

// 3) calendar-home 配下のカレンダー一覧（VEVENT対応のみ）
async function fetchCalendars(cred: IcloudCredential, homeUrl: string): Promise<CaldavCalendar[]> {
  const body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    "<d:prop><d:resourcetype/><d:displayname/>" +
    "<c:supported-calendar-component-set/></d:prop></d:propfind>";
  const res = await caldavRequest({
    method: "PROPFIND",
    url: homeUrl,
    cred,
    headers: { Depth: "1", "Content-Type": "application/xml; charset=utf-8" },
    body,
  });
  if (!res.ok) throw new Error(res.error ?? authErrorMessage(res.status));
  const doc = parseXml(res.body);
  const calendars: CaldavCalendar[] = [];
  for (const resp of responseHrefs(doc)) {
    if (!isVeventCalendar(resp)) continue;
    const href = firstHref(resp);
    if (!href) continue;
    const url = resolveHref(href, homeUrl);
    if (url === homeUrl) continue; // ホーム自身は除外
    const name = resp.getElementsByTagNameNS(DAV_NS, "displayname")[0]?.textContent?.trim();
    calendars.push({ url, displayName: name || "（無題のカレンダー）" });
  }
  return calendars;
}

// 接続テスト兼カレンダー一覧取得。失敗時は分かりやすいエラーを投げる。
export async function discoverIcloudCalendars(cred: IcloudCredential): Promise<CaldavCalendar[]> {
  const principal = await fetchPrincipalUrl(cred);
  const home = await fetchCalendarHome(cred, principal);
  return fetchCalendars(cred, home);
}
