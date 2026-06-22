import type { EventTemplate, ParsedEvent } from "../types";

// テンプレ＋日付（YYYY-MM-DD）から確定前のParsedEventを組み立てる。

function combine(dateStr: string, time: string): string {
  // dateStr="2026-06-15", time="09:00" → JSTのISO
  return `${dateStr}T${time}:00+09:00`;
}

function addMinutesIso(iso: string, minutes: number): string {
  const d = new Date(iso);
  const out = new Date(d.getTime() + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${out.getFullYear()}-${pad(out.getMonth() + 1)}-${pad(out.getDate())}` +
    `T${pad(out.getHours())}:${pad(out.getMinutes())}:00+09:00`
  );
}

export function buildEventFromTemplate(
  template: EventTemplate,
  dateStr: string,
  defaultDurationMin: number,
  override?: { startTime?: string; durationMin?: number },
): ParsedEvent {
  const startTime = override?.startTime ?? template.startTime;
  if (template.allDay || !startTime) {
    return {
      title: template.title,
      start: dateStr,
      allDay: true,
      location: template.location,
      confidence: 1,
      source: "manual",
    };
  }

  const start = combine(dateStr, startTime);
  const end = addMinutesIso(
    start,
    override?.durationMin ?? template.durationMin ?? defaultDurationMin,
  );
  return {
    title: template.title,
    start,
    end,
    allDay: false,
    location: template.location,
    confidence: 1,
    source: "manual",
  };
}
