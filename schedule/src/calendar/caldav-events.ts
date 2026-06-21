import ICAL from "ical.js";
import type { CalendarEvent, ParsedEvent } from "../types";
import type { IcloudCredential } from "./icloud-cred";
import { caldavRequest } from "./caldav-client";

// iCloud(CalDAV) のイベントCRUD。書き込みはUTCのVEVENTを生成して PUT、
// 読み取りは REPORT(calendar-query) で期間内イベントを取得し ical.js で解析する。

const CALDAV_NS = "urn:ietf:params:xml:ns:caldav";
const DAV_NS = "DAV:";
const MAX_OCCURRENCES = 200;

// テキスト値のエスケープ（RFC5545: \ ; , と改行）
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// ISO日時 → UTCの基本形式 20260621T060000Z
function toUtcStamp(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// "2026-06-21" → "20260621"
function toDateStamp(dateOnly: string): string {
  return dateOnly.slice(0, 10).replace(/-/g, "");
}

function addOneDay(dateOnly: string): string {
  const d = new Date(`${dateOnly.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// 75オクテット超の行を折りたたむ（簡易・先頭空白継続）
function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    parts.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

// ParsedEvent → 単一VEVENTを含むVCALENDARテキスト
export function buildVcalendar(event: ParsedEvent, uid: string): string {
  const now = toUtcStamp(new Date().toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Skatto Schedular//CalDAV//JA",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `SUMMARY:${escapeText(event.title || "(無題)")}`,
  ];

  if (event.allDay) {
    const d = event.start.slice(0, 10);
    lines.push(`DTSTART;VALUE=DATE:${toDateStamp(d)}`);
    lines.push(`DTEND;VALUE=DATE:${addOneDay(d)}`);
  } else {
    lines.push(`DTSTART:${toUtcStamp(event.start)}`);
    lines.push(`DTEND:${toUtcStamp(event.end ?? event.start)}`);
  }

  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.notes) lines.push(`DESCRIPTION:${escapeText(event.notes)}`);

  if (typeof event.reminderMin === "number" && event.reminderMin > 0) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:リマインダー",
      `TRIGGER:-PT${event.reminderMin}M`,
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function eventUrl(calendarUrl: string, uid: string): string {
  const base = calendarUrl.endsWith("/") ? calendarUrl : `${calendarUrl}/`;
  return `${base}${uid}.ics`;
}

function authError(status: number, fallback: string): Error {
  if (status === 401 || status === 403) {
    return new Error("iCloudの認証に失敗しました。アプリ用パスワードを確認してください。");
  }
  return new Error(fallback);
}

// 新規作成 → 作成したイベントの絶対URL(href)を返す
export async function insertIcloudEvent(
  cred: IcloudCredential,
  calendarUrl: string,
  event: ParsedEvent,
): Promise<string> {
  const uid = `${crypto.randomUUID()}@skatto`;
  const url = eventUrl(calendarUrl, uid);
  const res = await caldavRequest({
    method: "PUT",
    url,
    cred,
    headers: { "Content-Type": "text/calendar; charset=utf-8", "If-None-Match": "*" },
    body: buildVcalendar(event, uid),
  });
  if (!res.ok) throw authError(res.status, `iCloud登録に失敗 (${res.status})`);
  return url;
}

// 既存イベント(href)を上書き更新。UIDはhrefのファイル名から流用。
export async function updateIcloudEvent(
  cred: IcloudCredential,
  eventHref: string,
  event: ParsedEvent,
): Promise<void> {
  const uid = decodeURIComponent(eventHref.split("/").pop() ?? "").replace(/\.ics$/i, "");
  const res = await caldavRequest({
    method: "PUT",
    url: eventHref,
    cred,
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
    body: buildVcalendar(event, uid || `${crypto.randomUUID()}@skatto`),
  });
  if (!res.ok) throw authError(res.status, `iCloud更新に失敗 (${res.status})`);
}

export async function deleteIcloudEvent(
  cred: IcloudCredential,
  eventHref: string,
): Promise<void> {
  const res = await caldavRequest({ method: "DELETE", url: eventHref, cred });
  if (!res.ok && res.status !== 404) {
    throw authError(res.status, `iCloud削除に失敗 (${res.status})`);
  }
}

function timeToString(t: ICAL.Time): string {
  if (t.isDate) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${t.year}-${p(t.month)}-${p(t.day)}`;
  }
  return t.toJSDate().toISOString();
}

// 単一イベントのICS(calendar-data)を CalendarEvent[] に変換（繰り返し展開含む）
function parseEventIcs(
  text: string,
  href: string,
  etag: string | undefined,
  calendarUrl: string,
  calName: string,
  windowStart: ICAL.Time,
  windowEnd: ICAL.Time,
): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  let comp: ICAL.Component;
  try {
    comp = new ICAL.Component(ICAL.parse(text));
  } catch {
    return out;
  }
  const base = (
    start: ICAL.Time,
    end: ICAL.Time | null,
    summary: string,
    location: string | undefined,
    idSuffix: string,
  ): CalendarEvent => ({
    id: href + idSuffix,
    title: summary || "(無題)",
    start: timeToString(start),
    end: end ? timeToString(end) : undefined,
    allDay: start.isDate,
    location,
    calendarSummary: calName,
    provider: "icloud",
    calendarId: calendarUrl,
    href,
    etag,
  });

  for (const ve of comp.getAllSubcomponents("vevent")) {
    const ev = new ICAL.Event(ve);
    const summary = ev.summary ?? "";
    const location = ev.location || undefined;
    if (ev.isRecurring()) {
      const iter = ev.iterator(ev.startDate);
      let next = iter.next();
      let count = 0;
      while (next && count < MAX_OCCURRENCES) {
        if (next.compare(windowEnd) > 0) break;
        if (next.compare(windowStart) >= 0) {
          const d = ev.getOccurrenceDetails(next);
          out.push(base(d.startDate, d.endDate, summary, location, `-${next.toUnixTime()}`));
        }
        next = iter.next();
        count += 1;
      }
    } else {
      const start = ev.startDate;
      const end = ev.endDate ?? null;
      const effEnd = end ?? start;
      if (effEnd.compare(windowStart) >= 0 && start.compare(windowEnd) <= 0) {
        out.push(base(start, end, summary, location, ""));
      }
    }
  }
  return out;
}

// 指定カレンダーを期間で取得（REPORT calendar-query）
export async function listIcloudEventsRange(
  cred: IcloudCredential,
  calendarUrl: string,
  calName: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const start = toUtcStamp(timeMin.toISOString());
  const end = toUtcStamp(timeMax.toISOString());
  const body =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">' +
    "<d:prop><d:getetag/><c:calendar-data/></d:prop>" +
    '<c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">' +
    `<c:time-range start="${start}" end="${end}"/>` +
    "</c:comp-filter></c:comp-filter></c:filter></c:calendar-query>";
  const res = await caldavRequest({
    method: "REPORT",
    url: calendarUrl,
    cred,
    headers: { Depth: "1", "Content-Type": "application/xml; charset=utf-8" },
    body,
  });
  if (!res.ok) throw authError(res.status, `iCloud取得に失敗 (${res.status})`);

  const doc = new DOMParser().parseFromString(res.body, "application/xml");
  const windowStart = ICAL.Time.fromJSDate(timeMin, false);
  const windowEnd = ICAL.Time.fromJSDate(timeMax, false);
  const out: CalendarEvent[] = [];
  for (const resp of Array.from(doc.getElementsByTagNameNS(DAV_NS, "response"))) {
    const href = resp.getElementsByTagNameNS(DAV_NS, "href")[0]?.textContent;
    const data = resp.getElementsByTagNameNS(CALDAV_NS, "calendar-data")[0]?.textContent;
    const etag = resp.getElementsByTagNameNS(DAV_NS, "getetag")[0]?.textContent ?? undefined;
    if (!href || !data) continue;
    const absHref = new URL(href, calendarUrl).toString();
    out.push(
      ...parseEventIcs(data, absHref, etag, calendarUrl, calName, windowStart, windowEnd),
    );
  }
  return out;
}
