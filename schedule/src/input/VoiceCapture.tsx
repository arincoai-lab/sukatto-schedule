import { useEffect, useRef, useState } from "react";

// Web Speech API による音声入力。話した内容を文字起こしして解析器へ渡す。
// 非対応ブラウザ（特に一部のiOS Safari）では検知して手動入力へ誘導する。

interface Props {
  onResult: (text: string) => void;
  onCancel: () => void;
}

// SpeechRecognition は標準型が無いため最小限の型を定義
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export default function VoiceCapture({ onResult, onCancel }: Props) {
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("このブラウザは音声入力に対応していません。文字入力をご利用ください。");
      return;
    }
    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev) => {
      let text = "";
      for (let i = 0; i < ev.results.length; i++) {
        text += ev.results[i][0].transcript;
      }
      finalRef.current = text;
      setTranscript(text);
    };
    rec.onerror = (ev) => {
      setError(`音声認識エラー: ${ev.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;

    try {
      rec.start();
      setListening(true);
    } catch {
      setError("マイクを開始できませんでした。");
    }

    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  const stopAndUse = () => {
    recRef.current?.stop();
    const text = finalRef.current.trim();
    if (text) onResult(text);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>{listening ? "聞いています…" : "音声で追加"}</h2>

        {error ? (
          <div className="banner error">{error}</div>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0 0 12px" }}>
            予定を話してください。例:「来週火曜の午後3時に歯医者」
          </p>
        )}

        <div
          className="card"
          style={{ minHeight: 64, fontSize: "1.1rem", textAlign: "center" }}
        >
          {transcript || (listening ? "…" : "（認識結果がここに表示されます）")}
        </div>

        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel}>
            やめる
          </button>
          <button
            className="btn primary"
            disabled={!transcript.trim()}
            onClick={stopAndUse}
          >
            この内容で解析
          </button>
        </div>
      </div>
    </div>
  );
}
