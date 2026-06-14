import type { ParsedEvent } from "../types";
import { isoToLocalInput, localInputToIso, dateOnly } from "../util/datetime";

// 予定の編集フィールド一式（作成確認・既存編集の両方で再利用）。
// タイトル / 終日 / 開始・終了 / 場所 / 通知（リマインダー）。

const REMINDER_OPTIONS: { label: string; value: number }[] = [
  { label: "通知なし", value: 0 },
  { label: "10分前", value: 10 },
  { label: "30分前", value: 30 },
  { label: "1時間前", value: 60 },
  { label: "1日前", value: 1440 },
];

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: "1rem",
};

export default function EventFields({
  event,
  onChange,
}: {
  event: ParsedEvent;
  onChange: (e: ParsedEvent) => void;
}) {
  return (
    <>
      <div className="field">
        <label>タイトル</label>
        <input
          value={event.title}
          onChange={(e) => onChange({ ...event, title: e.target.value })}
          placeholder="予定の内容"
        />
      </div>

      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={Boolean(event.allDay)}
            onChange={(e) => onChange({ ...event, allDay: e.target.checked })}
            style={{ width: "auto", marginRight: 6 }}
          />
          終日
        </label>
      </div>

      {event.allDay ? (
        <div className="field">
          <label>日付</label>
          <input
            type="date"
            value={dateOnly(event.start)}
            onChange={(e) => onChange({ ...event, start: e.target.value })}
          />
        </div>
      ) : (
        <div className="row">
          <div className="field">
            <label>開始</label>
            <input
              type="datetime-local"
              value={isoToLocalInput(event.start)}
              onChange={(e) => onChange({ ...event, start: localInputToIso(e.target.value) })}
            />
          </div>
          <div className="field">
            <label>終了</label>
            <input
              type="datetime-local"
              value={event.end ? isoToLocalInput(event.end) : ""}
              onChange={(e) => onChange({ ...event, end: localInputToIso(e.target.value) })}
            />
          </div>
        </div>
      )}

      <div className="field">
        <label>場所（任意）</label>
        <input
          value={event.location ?? ""}
          onChange={(e) => onChange({ ...event, location: e.target.value })}
        />
      </div>

      <div className="field">
        <label>通知</label>
        <select
          style={selectStyle}
          value={event.reminderMin ?? 0}
          onChange={(e) => onChange({ ...event, reminderMin: Number(e.target.value) })}
        >
          {REMINDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
