import { useState } from "react";
import type { ParsedEvent } from "../types";
import EventFields from "./EventFields";

// AIの解釈を1タップで修正・確定する確認UI。誤認識対策＝体験の要。
// 複数予定はカードごとに編集/破棄でき、まとめて登録する。

interface Props {
  events: ParsedEvent[];
  warnings?: string[];
  saving: boolean;
  onCancel: () => void;
  onConfirm: (events: ParsedEvent[]) => void;
}

function EventEditor({
  event,
  onChange,
  onRemove,
  removable,
}: {
  event: ParsedEvent;
  onChange: (e: ParsedEvent) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const lowConfidence = event.confidence < 0.5;
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span className={`badge ${lowConfidence ? "low" : "ok"}`}>
          {lowConfidence ? "要確認" : "OK"}
        </span>
        {removable && (
          <button className="link-btn" onClick={onRemove}>
            この予定を削除
          </button>
        )}
      </div>
      <EventFields event={event} onChange={onChange} />
    </div>
  );
}

export default function EventConfirm({
  events,
  warnings,
  saving,
  onCancel,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState<ParsedEvent[]>(events);

  const updateAt = (i: number, e: ParsedEvent) =>
    setDraft((prev) => prev.map((p, idx) => (idx === i ? e : p)));
  const removeAt = (i: number) =>
    setDraft((prev) => prev.filter((_, idx) => idx !== i));

  const canSave = draft.length > 0 && draft.every((e) => e.title.trim() && e.start);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>内容を確認</h2>
        <p className="sub" style={{ color: "var(--muted)", margin: "0 0 12px" }}>
          AIの解釈です。違っていればその場で直してください。
        </p>

        {warnings?.map((w, i) => (
          <div key={i} className="banner warn">
            {w}
          </div>
        ))}

        {draft.map((e, i) => (
          <EventEditor
            key={i}
            event={e}
            onChange={(ev) => updateAt(i, ev)}
            onRemove={() => removeAt(i)}
            removable={draft.length > 1}
          />
        ))}

        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel} disabled={saving}>
            やめる
          </button>
          <button
            className="btn primary"
            onClick={() => onConfirm(draft)}
            disabled={!canSave || saving}
          >
            {saving ? (
              <>
                <span className="spinner" />
                登録中…
              </>
            ) : (
              `カレンダーに登録${draft.length > 1 ? `（${draft.length}件）` : ""}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
