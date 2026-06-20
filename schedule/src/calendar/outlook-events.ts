import type { CalendarEvent, ParsedEvent } from "../types";

// Microsoft Graph API ラッパ（Outlook/Microsoft 365 カレンダー）。
// 認証はoutlook-auth.tsで取得したアクセストークンを使う。
// ドキュメント: https://learn.microsoft.com/en-us/graph/api/resources/event

const BASE = "https://graph.microsoft.com/v1.0";
const TZ = "Tokyo Standard Time"; // Microsoft Graph は IANA 名ではなく Windows TZ 名

async function gfetch(token: string, path: string, init?: RequestInit): Promise<unknown> {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: `outlook.timezone="${TZ}"`,
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Microsoft Graph エラー (${resp.status}): ${detail.slice(0, 200)}`);
  }
  // 一部は204(No Content)を返す
  const text = await resp.text();
  return text ? JSON.parse(text) : null;
}

interface MGraphEvent {
  id: string;
  subject?: string;
  location?: { displayName?: string };
  isAllDay?: boolean;
  start: { dateTime: string; timeZone?: string };
  end?: { dateTime: string; timeZone?: string };
}

// "Tokyo Standard Time" のローカル時刻文字列(2026-06-19T15:00:00) を ISO(+09:00) へ
function tzLocalToIso(dt: string): string {
  // Microsoft は秒以下も含む可能性あり、Tの後に時間
  if (/[+-]\d{2}:?\d{2}$|Z$/.test(dt)) return dt; // 既にオフセット付き
  return `${dt.replace(/\.\d+$/, "")}+09:00`;
}

function mapGraphEvent(it: MGraphEvent, calendarId: string): CalendarEvent {
  const allDay = Boolean(it.isAllDay);
  const start = allDay ? it.start.dateTime.slice(0, 10) : tzLocalToIso(it.start.dateTime);
  const end = it.end ? (allDay ? it.end.dateTime.slice(0, 10) : tzLocalToIso(it.end.dateTime)) : undefined;
  return {
    id: it.id,
    title: it.subject || "(無題)",
    start,
    end,
    allDay,
    location: it.location?.displayName || undefined,
    provider: "outlook",
    calendarId,
  };
}

interface MGraphCalendar {
  id: string;
  name: string;
  isDefaultCalendar?: boolean;
}

export async function listOutlookCalendars(
  token: string,
): Promise<{ id: string; summary: string; primary: boolean }[]> {
  const data = (await gfetch(token, "/me/calendars?$top=100")) as { value: MGraphCalendar[] };
  return data.value.map((c) => ({
    id: c.id,
    summary: c.name,
    primary: Boolean(c.isDefaultCalendar),
  }));
}

// ParsedEvent → Microsoft Graph event 本文
function buildOutlookBody(event: ParsedEvent): Record<string, unknown> {
  const body: Record<string, unknown> = {
    subject: event.title,
    location: event.location ? { displayName: event.location } : undefined,
    body: event.notes ? { contentType: "text", content: event.notes } : undefined,
    isAllDay: Boolean(event.allDay),
  };

  if (event.allDay) {
    const dateOnly = event.start.slice(0, 10);
    body.start = { dateTime: `${dateOnly}T00:00:00`, timeZone: TZ };
    body.end = { dateTime: `${dateOnly}T00:00:00`, timeZone: TZ };
  } else {
    // ISO(+09:00) → ローカル時刻部分のみ取り出し、Windows TZ名を併記
    const stripTz = (iso: string) =>
      iso.replace(/[+-]\d{2}:?\d{2}$|Z$/, "").replace(/\.\d+$/, "");
    body.start = { dateTime: stripTz(event.start), timeZone: TZ };
    body.end = { dateTime: stripTz(event.end ?? event.start), timeZone: TZ };
  }

  // リマインダー（分前）
  if (typeof event.reminderMin === "number") {
    if (event.reminderMin > 0) {
      body.isReminderOn = true;
      body.reminderMinutesBeforeStart = event.reminderMin;
    } else {
      body.isReminderOn = false;
    }
  }

  return body;
}

export async function insertOutlookEvent(
  token: string,
  calendarId: string,
  event: ParsedEvent,
): Promise<string> {
  const created = (await gfetch(token, `/me/calendars/${calendarId}/events`, {
    method: "POST",
    body: JSON.stringify(buildOutlookBody(event)),
  })) as { id: string };
  return created.id;
}

export async function updateOutlookEvent(
  token: string,
  calendarId: string,
  eventId: string,
  event: ParsedEvent,
): Promise<void> {
  await gfetch(token, `/me/calendars/${calendarId}/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(buildOutlookBody(event)),
  });
}

export async function deleteOutlookEvent(
  token: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  await gfetch(token, `/me/calendars/${calendarId}/events/${eventId}`, {
    method: "DELETE",
  });
}

// 期間指定で予定取得
export async function listOutlookEventsRange(
  token: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    startDateTime: timeMin.toISOString(),
    endDateTime: timeMax.toISOString(),
    $top: "250",
  });
  const data = (await gfetch(
    token,
    `/me/calendars/${calendarId}/calendarView?${params}`,
  )) as { value: MGraphEvent[] };
  return data.value.map((it) => mapGraphEvent(it, calendarId));
}
