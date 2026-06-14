import { useState } from "react";
import type { ParsedEvent } from "../types";
import EventFields from "./EventFields";

// 既存のGoogle予定を編集/削除するモーダル。

interface Props {
  event: ParsedEvent;
  busy: boolean;
  onCancel: () => void;
  onSave: (event: ParsedEvent) => void;
  onDelete: () => void;
}

export default function EventEdit({ event, busy, onCancel, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<ParsedEvent>(event);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canSave = Boolean(draft.title.trim() && draft.start);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>予定を編集</h2>

        <div className="card">
          <EventFields event={draft} onChange={setDraft} />
        </div>

        {confirmDelete ? (
          <div className="banner error">
            この予定を削除しますか？
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
                やめる
              </button>
              <button
                className="btn"
                style={{ background: "var(--danger)", color: "#3a0a0a" }}
                onClick={onDelete}
                disabled={busy}
              >
                {busy ? "削除中…" : "削除する"}
              </button>
            </div>
          </div>
        ) : (
          <button
            className="link-btn"
            style={{ color: "var(--danger)", display: "block", margin: "4px 0 12px" }}
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            この予定を削除
          </button>
        )}

        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel} disabled={busy}>
            やめる
          </button>
          <button
            className="btn primary"
            onClick={() => onSave(draft)}
            disabled={!canSave || busy}
          >
            {busy ? (
              <>
                <span className="spinner" />
                保存中…
              </>
            ) : (
              "更新する"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
