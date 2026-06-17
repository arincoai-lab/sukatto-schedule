import { useMemo, useState } from "react";
import type { CalendarEvent } from "../types";
import { formatTime } from "../util/datetime";

// 月カレンダー表示。登録済み予定をグリッドで俯瞰し、日をタップでその日の予定を一覧。

interface Props {
  events: CalendarEvent[];
  monthCursor: Date; // 表示中の月（その月の任意の日）
  loading: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// グリッド先頭（その月1日を含む週の日曜）から42日分の日付配列
function buildGridDays(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function MonthView({
  events,
  monthCursor,
  loading,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectEvent,
}: Props) {
  const todayKey = ymd(new Date());
  const [selectedKey, setSelectedKey] = useState<string>(todayKey);

  // 日付キー → イベント配列
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.start.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const days = useMemo(() => buildGridDays(monthCursor), [monthCursor]);
  const monthNum = monthCursor.getMonth();
  const selectedEvents = byDate.get(selectedKey) ?? [];

  return (
    <div className="month">
      <div className="month-head">
        <button className="month-nav" onClick={onPrevMonth} aria-label="前の月">
          ‹
        </button>
        <button className="month-title" onClick={onToday} title="今日へ">
          {monthCursor.getFullYear()}年{monthNum + 1}月
        </button>
        <button className="month-nav" onClick={onNextMonth} aria-label="次の月">
          ›
        </button>
      </div>

      <div className="month-grid month-weekdays">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`wd ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="month-grid">
        {days.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === monthNum;
          const dayEvents = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              className={`day-cell${inMonth ? "" : " dim"}${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
              onClick={() => setSelectedKey(key)}
            >
              <span className="day-num">{d.getDate()}</span>
              <span className="day-dots">
                {dayEvents.slice(0, 4).map((e, i) => (
                  <span
                    key={i}
                    className={`dot ${e.provider === "ics" ? "ics" : "google"}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="month-day-list">
        <div className="section-label">{selectedKey.replace(/-/g, "/")} の予定</div>
        {loading ? (
          <div className="empty">
            <span className="spinner" />
            読み込み中…
          </div>
        ) : selectedEvents.length === 0 ? (
          <div className="empty">予定はありません</div>
        ) : (
          selectedEvents.map((e) => {
            const editable = e.provider === "google";
            return (
              <div
                key={e.id}
                className="card"
                onClick={editable ? () => onSelectEvent(e) : undefined}
                style={editable ? { cursor: "pointer" } : undefined}
              >
                <div className="title">{e.title}</div>
                <div className="meta">
                  {e.allDay ? "終日" : formatTime(e.start)}
                  {e.location ? ` ・ ${e.location}` : ""}
                  {e.calendarSummary ? ` ・ ${e.calendarSummary}` : ""}
                  {editable ? "" : " ・ 閲覧のみ"}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
