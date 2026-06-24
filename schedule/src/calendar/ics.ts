import ICAL from "ical.js";
import type { CalendarEvent } from "../types";

// 外部カレンダー(Outlook等、公開.ics対応)のICSを極小プロキシ経由で取得し、
// 表示期間内のイベント（繰り返し展開含む）に変換する。読み取り専用。

export interface IcsSource {
  id: string;
  label: string;
  url: string;
}

const MAX_OCCURRENCES = 200; // 繰り返し展開の暴走防止

function proxyUrl(icsUrl: string): string {
  return `/api/ics?url=${encodeURIComponent(icsUrl)}`;
}

// 終日(date-only)はTZ変換で日付がずれるため、暦日をそのまま保持する。
// 時刻付きはJSの瞬時(ISO)へ変換。
function timeToString(t: ICAL.Time): string {
  if (t.isDate) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${t.year}-${p(t.month)}-${p(t.day)}`;
  }
  return t.toJSDate().toISOString();
}

function toCalendarEvent(
  id: string,
  summary: string,
  start: ICAL.Time,
  end: ICAL.Time | null,
  location: string | undefined,
  sourceLabel: string,
): CalendarEvent {
  return {
    id,
    title: summary || "(無題)",
    start: timeToString(start),
    end: end ? timeToString(end) : undefined,
    allDay: start.isDate,
    location,
    calendarSummary: sourceLabel,
    provider: "ics",
  };
}

function parseIcsText(
  text: string,
  sourceLabel: string,
  rangeStart: Date,
  rangeEnd: Date,
): CalendarEvent[] {
  const jcal = ICAL.parse(text);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");

  const windowStart = ICAL.Time.fromJSDate(rangeStart, false);
  const windowEnd = ICAL.Time.fromJSDate(rangeEnd, false);

  const out: CalendarEvent[] = [];

  for (const ve of vevents) {
    const event = new ICAL.Event(ve);
    const summary = event.summary ?? "";
    const location = event.location || undefined;

    if (event.isRecurring()) {
      const iter = event.iterator(event.startDate);
      let next = iter.next();
      let count = 0;
      while (next && count < MAX_OCCURRENCES) {
        if (next.compare(windowEnd) > 0) break;
        if (next.compare(windowStart) >= 0) {
          const details = event.getOccurrenceDetails(next);
          out.push(
            toCalendarEvent(
              `${event.uid}-${next.toUnixTime()}`,
              summary,
              details.startDate,
              details.endDate,
              location,
              sourceLabel,
            ),
          );
        }
        next = iter.next();
        count += 1;
      }
    } else {
      const start = event.startDate;
      const end = event.endDate ?? null;
      const effEnd = end ?? start;
      if (effEnd.compare(windowStart) >= 0 && start.compare(windowEnd) <= 0) {
        out.push(
          toCalendarEvent(event.uid, summary, start, end, location, sourceLabel),
        );
      }
    }
  }
  return out;
}

// 単一ソースを指定期間で取得・解析。失敗はソース単位で握りつぶし、warningsへ集約する側で扱う。
export async function fetchIcsSource(
  source: IcsSource,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<CalendarEvent[]> {
  const resp = await fetch(proxyUrl(source.url));
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`「${source.label}」取得失敗: ${detail.slice(0, 120) || resp.status}`);
  }
  const text = await resp.text();
  return parseIcsText(text, source.label, rangeStart, rangeEnd);
}
