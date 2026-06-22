import { useState } from "react";
import type { EventTemplate } from "../types";
import { FREE_TEMPLATE_LIMIT, canAddTemplate } from "../store/pro";
import { track, EVENTS } from "../util/analytics";
import { durationMinBetween, endTime } from "./time";

// よく使う予定テンプレの編集。作成済みテンプレの名称・開始/終了時間・終日をその場で修正でき、
// 新規作成時も開始・終了を指定できる（規定値はプリセット）。

interface Props {
  templates: EventTemplate[];
  isPro: boolean;
  onChange: (t: EventTemplate[]) => void;
}

export default function TemplatesEditor({ templates, isPro, onChange }: Props) {
  const [label, setLabel] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const atLimit = !canAddTemplate(isPro, templates.length);

  const patch = (id: string, p: Partial<EventTemplate>) => {
    onChange(templates.map((t) => (t.id === id ? { ...t, ...p } : t)));
  };

  const remove = (id: string) => onChange(templates.filter((t) => t.id !== id));

  const add = () => {
    if (!label.trim()) return;
    if (atLimit) {
      track(EVENTS.templateLimitHit);
      return;
    }
    const next: EventTemplate = {
      id: crypto.randomUUID(),
      label: label.trim(),
      title: label.trim(),
      allDay,
      startTime: allDay ? undefined : start,
      durationMin: allDay ? undefined : durationMinBetween(start, end),
    };
    onChange([...templates, next]);
    setLabel("");
  };

  return (
    <div>
      {/* 既存テンプレの編集 */}
      {templates.map((t) => {
        const s = t.startTime ?? "09:00";
        return (
          <div className="card" key={t.id} style={{ marginBottom: 8 }}>
            <div className="row" style={{ alignItems: "center" }}>
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <input
                  value={t.label}
                  onChange={(e) => patch(t.id, { label: e.target.value, title: e.target.value })}
                  placeholder="名前（例: 出勤）"
                  aria-label="テンプレ名"
                />
              </div>
              <button
                className="link-btn"
                style={{ color: "var(--danger)", flexShrink: 0 }}
                onClick={() => remove(t.id)}
              >
                削除
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
              <label style={{ display: "flex", alignItems: "center", fontSize: "0.82rem", color: "var(--muted)" }}>
                <input
                  type="checkbox"
                  checked={t.allDay}
                  onChange={(e) =>
                    patch(
                      t.id,
                      e.target.checked
                        ? { allDay: true }
                        : { allDay: false, startTime: s, durationMin: t.durationMin ?? 60 },
                    )
                  }
                  style={{ width: "auto", marginRight: 6 }}
                />
                終日
              </label>
              {!t.allDay && (
                <div className="row" style={{ flex: 1 }}>
                  <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                    <label>開始</label>
                    <input
                      type="time"
                      value={s}
                      onChange={(e) => patch(t.id, { startTime: e.target.value })}
                    />
                  </div>
                  <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                    <label>終了</label>
                    <input
                      type="time"
                      value={endTime(s, t.durationMin ?? 60)}
                      onChange={(e) =>
                        patch(t.id, { durationMin: durationMinBetween(s, e.target.value) })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 新規追加 */}
      <div className="section-label" style={{ marginTop: 12 }}>テンプレを追加</div>
      <div className="field">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="名前（例: 出勤）"
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", fontSize: "0.82rem", color: "var(--muted)" }}>
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            style={{ width: "auto", marginRight: 6 }}
          />
          終日
        </label>
        {!allDay && (
          <div className="row" style={{ flex: 1 }}>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>開始</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label>終了</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        )}
      </div>
      {atLimit && (
        <div className="banner warn" style={{ marginBottom: 8 }}>
          無料プランのテンプレは{FREE_TEMPLATE_LIMIT}種類までです。Proで無制限になります。
        </div>
      )}
      <button
        className="btn"
        style={{ width: "100%" }}
        disabled={!label.trim() || atLimit}
        onClick={add}
      >
        ＋ テンプレを追加
      </button>
    </div>
  );
}
