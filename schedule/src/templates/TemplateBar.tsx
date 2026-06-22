import { useState } from "react";
import type { EventTemplate } from "../types";

// よく使う予定テンプレのチップ。タップ→日付を選ぶだけで登録フローへ。

interface Props {
  templates: EventTemplate[];
  onPick: (template: EventTemplate, dateStr: string) => void;
}

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function TemplateBar({ templates, onPick }: Props) {
  const [picking, setPicking] = useState<EventTemplate | null>(null);
  const [date, setDate] = useState(todayStr());

  if (templates.length === 0) return null;

  const open = (t: EventTemplate) => {
    setDate(todayStr());
    setPicking(t);
  };

  const confirm = () => {
    if (picking) onPick(picking, date);
    setPicking(null);
  };

  return (
    <>
      {/* 横スクロールのストリップ。テンプレが増えても縦に伸びず、入力ドック直上に収まる。 */}
      <div className="quick-strip" aria-label="クイック登録">
        {templates.map((t) => (
          <button key={t.id} className="quick-chip" onClick={() => open(t)}>
            <span className="quick-chip-label">{t.label}</span>
            <span className="quick-chip-sub">{t.allDay ? "終日" : t.startTime}</span>
          </button>
        ))}
      </div>

      {picking && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>「{picking.label}」を登録</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0 0 12px" }}>
              日付を選んでください。
            </p>
            <div className="btn-row" style={{ marginBottom: 12 }}>
              <button className="btn" onClick={() => setDate(todayStr())}>
                今日
              </button>
              <button className="btn" onClick={() => setDate(todayStr(1))}>
                明日
              </button>
              <button className="btn" onClick={() => setDate(todayStr(2))}>
                明後日
              </button>
            </div>
            <div className="field">
              <label>日付</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setPicking(null)}>
                やめる
              </button>
              <button className="btn primary" onClick={confirm}>
                登録する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
