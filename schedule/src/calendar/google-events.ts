import type { ParsedEvent, CalendarEvent } from "../types";

// Google Calendar REST API v3 をアクセストークンで直接呼ぶ（クライアント完結）。

const BASE = "https://www.googleapis.com/calendar/v3";
const TZ = "Asia/Tokyo";

interface GApiEvent {
  id: string;
  summary?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

async function gfetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Google API エラー (${resp.status}): ${detail.slice(0, 200)}`);
  }
  return resp.json();
}

// ParsedEvent → Google APIのイベント本文へ。リマインダー(通知)も設定する。
function buildEventBody(event: ParsedEvent): Record<string, unknown> {
  const body: Record<string, unknown> = {
    summary: event.title,
    location: event.location,
    description: event.notes,
  };

  if (event.allDay) {
    const dateOnly = event.start.slice(0, 10);
    body.start = { date: dateOnly };
    body.end = { date: dateOnly };
  } else {
    body.start = { dateTime: event.start, timeZone: TZ };
    body.end = { dateTime: event.end ?? event.start, timeZone: TZ };
  }

  // reminderMin が指定されていればGoogle側でポップアップ通知（全端末で確実に通知）
  if (typeof event.reminderMin === "number" && event.reminderMin > 0) {
    body.reminders = {
      useDefault: false,
      overrides: [{ method: "popup", minutes: event.reminderMin }],
    };
  } else if (event.reminderMin === 0) {
    body.reminders = { useDefault: false, overrides: [] };
  }
  return body;
}

// 確定イベントをカレンダーへ作成
export async function insertEvent(
  token: string,
  calendarId: string,
  event: ParsedEvent,
): Promise<string> {
  const created = (await gfetch(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(buildEventBody(event)) },
  )) as { id: string };
  return created.id;
}

// 既存イベントを更新
export async function updateEvent(
  token: string,
  calendarId: string,
  eventId: string,
  event: ParsedEvent,
): Promise<void> {
  await gfetch(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(buildEventBody(event)) },
  );
}

// イベントを削除
export async function deleteEvent(
  token: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const resp = await fetch(
    `${BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok && resp.status !== 410) {
    // 410 Gone は既に削除済み扱いで許容
    const detail = await resp.text();
    throw new Error(`削除に失敗 (${resp.status}): ${detail.slice(0, 150)}`);
  }
}

// 直近の予定を取得（アジェンダ表示用）
export async function listUpcoming(
  token: string,
  calendarId: string,
  maxResults = 30,
): Promise<CalendarEvent[]> {
  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
  });
  const data = (await gfetch(
    token,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
  )) as { items?: GApiEvent[] };

  return (data.items ?? []).map((it) => {
    const allDay = Boolean(it.start.date);
    return {
      id: it.id,
      title: it.summary || "(無題)",
      start: it.start.dateTime ?? it.start.date ?? "",
      end: it.end?.dateTime ?? it.end?.date,
      allDay,
      location: it.location,
      provider: "google" as const,
    };
  });
}

interface GCalListItem {
  id: string;
  summary: string;
  primary?: boolean;
}

// 書き込み先カレンダー選択用の一覧
export async function listCalendars(
  token: string,
): Promise<{ id: string; summary: string; primary: boolean }[]> {
  const data = (await gfetch(token, `/users/me/calendarList`)) as {
    items?: GCalListItem[];
  };
  return (data.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: Boolean(c.primary),
  }));
}
