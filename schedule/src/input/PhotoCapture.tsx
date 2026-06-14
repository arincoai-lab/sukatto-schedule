import { useRef, useState } from "react";
import { imageToText } from "../parse/ocr";

// 写真（チラシ・紙の予定表・スクショ）からOCRでテキストを抽出し解析器へ渡す。
// 認識結果は編集可能なステップで確認・修正できる（OCR誤りをその場で直す＝精度に直結）。

interface Props {
  onText: (text: string) => void;
  onCancel: () => void;
}

export default function PhotoCapture({ onText, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recognized, setRecognized] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setProgress(0);
    try {
      const text = await imageToText(file, (p) => setProgress(p));
      setProgress(null);
      if (!text.trim()) {
        setError("文字を読み取れませんでした。明るく・正面から撮り直してください。");
        return;
      }
      setRecognized(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "画像の処理に失敗しました");
      setProgress(null);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>写真で追加</h2>

        {error && <div className="banner error">{error}</div>}

        {recognized === null ? (
          <>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0 0 12px" }}>
              予定が書かれた紙やスクショを撮影/選択してください。
            </p>
            {progress !== null ? (
              <div className="card" style={{ textAlign: "center" }}>
                <span className="spinner" />
                文字を読み取り中… {Math.round(progress * 100)}%
              </div>
            ) : (
              <button className="btn primary" onClick={() => inputRef.current?.click()}>
                写真を撮る / 選ぶ
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={onCancel} disabled={progress !== null}>
                やめる
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0 0 8px" }}>
              読み取った文字です。間違いがあれば直してから解析してください。
            </p>
            <div className="field">
              <textarea
                value={recognized}
                onChange={(e) => setRecognized(e.target.value)}
                style={{ minHeight: 120 }}
              />
            </div>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setRecognized(null)}>
                撮り直す
              </button>
              <button
                className="btn primary"
                disabled={!recognized.trim()}
                onClick={() => onText(recognized.trim())}
              >
                解析する
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
