import { useState } from "react";

// 手動クイック追加。音声/写真が使えない時の確実な入力経路。
// 自然文をそのまま解析器に渡す（「明日15時 歯医者」など）。

interface Props {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export default function QuickAdd({ onSubmit, onCancel }: Props) {
  const [text, setText] = useState("");

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>文字で追加</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0 0 12px" }}>
          いつもの言い方でOK。例:「来週火曜の15時に歯医者」
        </p>
        <div className="field">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="明日10時から会議 @渋谷"
          />
        </div>
        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel}>
            やめる
          </button>
          <button
            className="btn primary"
            disabled={!text.trim()}
            onClick={() => onSubmit(text.trim())}
          >
            解析する
          </button>
        </div>
      </div>
    </div>
  );
}
