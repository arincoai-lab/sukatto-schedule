import type { CalendarEvent } from "../types";
import { formatDateLabel, formatTime } from "../util/datetime";

// Googleカレンダーの直近予定をアジェンダ（日付ごと）で表示。

interface Props {
  events: CalendarEvent[];
  loading: boolean;
  connected: boolean;
  onSelect: (event: CalendarEvent) => void;
}

function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = e.start.slice(0, 10);
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  return map;
}

export default function AgendaView({ events, loading, connected, onSelect }: Props) {
  if (!connected) {
    return (
      <div className="empty">
        Googleカレンダーに接続すると、ここに予定が表示されます。
      </div>
    );
  }
  if (loading) {
    return (
      <div className="empty">
        <span className="spinner" />
        予定を読み込み中…
      </div>
    );
  }
  if (events.length === 0) {
    return <div className="empty">直近の予定はありません。下のボタンから追加できます。</div>;
  }

  const groups = [...groupByDate(events).entries()];

  return (
    <div>
      {groups.map(([dateKey, items]) => (
        <div key={dateKey}>
          <div className="section-label">{formatDateLabel(dateKey)}</div>
          {items.map((e) => {
            const editable = e.provider === "google";
            return (
              <div
                className="card"
                key={e.id}
                onClick={editable ? () => onSelect(e) : undefined}
                style={editable ? { cursor: "pointer" } : undefined}
                role={editable ? "button" : undefined}
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
          })}
        </div>
      ))}
    </div>
  );
}
