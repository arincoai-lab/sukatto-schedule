import type { MLCEngineInterface } from "@mlc-ai/web-llm";
import type { ParsedEvent, ParseResult, EventSource } from "../types";

// 端末内オープンLLM（WebGPU）で自然文/OCRテキストを構造化イベントへ変換。
// 有料API・サーバーは一切使わない。初回のみモデルをDLしブラウザにキャッシュ。

const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

// WebLLM本体はバンドルせず実行時にCDNから読み込む（WebLLM公式推奨のCDN利用）。
// これによりビルド成果物に巨大チャンクを含めず、デプロイのOOMを回避する。
// 変数経由の動的importにすることで Vite/TS の静的解決を回避（@vite-ignore でVite素通し）。
const WEBLLM_CDN = "https://esm.run/@mlc-ai/web-llm";

export type LoadProgress = (report: { progress: number; text: string }) => void;

let enginePromise: Promise<MLCEngineInterface> | null = null;

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// エンジンは初回利用時に遅延初期化。WebLLM本体・モデルとも初回のみ取得しキャッシュ。
export async function ensureEngine(
  onProgress?: LoadProgress,
): Promise<MLCEngineInterface> {
  if (!isWebGpuAvailable()) {
    throw new Error("WebGPU 非対応のため端末内LLMを利用できません");
  }
  if (!enginePromise) {
    enginePromise = (async () => {
      const webllm = (await import(/* @vite-ignore */ WEBLLM_CDN)) as typeof import("@mlc-ai/web-llm");
      return webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (r) =>
          onProgress?.({ progress: r.progress, text: r.text }),
      });
    })();
  }
  return enginePromise;
}

// 現在時刻はローカル時刻＋実オフセットで渡す。toISOString()はUTCのため、
// JST深夜帯に「明日」等の相対表現が1日ずれる（例: 23:30が前日14:30Z扱い）。
function toLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

function buildPrompt(text: string, now: Date): string {
  const iso = toLocalIso(now);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
  return [
    "あなたは日本語のスケジュール抽出器です。",
    `現在の日時は ${iso}（${weekday}曜日）です。`,
    "次の入力文から予定を抽出し、JSONのみを出力してください。説明文は禁止。",
    "出力スキーマ: {\"events\": [{\"title\": string, \"start\": ISO8601文字列(+09:00), \"end\"?: ISO8601, \"allDay\"?: boolean, \"location\"?: string, \"notes\"?: string}]}",
    "規則: 相対表現（明日・来週火曜など）は現在日時を基準に絶対日時へ変換。時刻が無ければ allDay=true。終了時刻が無ければ省略可。予定が複数あれば配列に複数入れる。",
    "",
    `入力文: ${text}`,
  ].join("\n");
}

interface RawEvent {
  title?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  notes?: string;
}

function coerceEvents(raw: unknown, source: EventSource): ParsedEvent[] {
  const obj = raw as { events?: RawEvent[] } | null;
  const list = Array.isArray(obj?.events) ? obj!.events! : [];
  const out: ParsedEvent[] = [];
  for (const e of list) {
    if (!e || !e.start) continue;
    out.push({
      title: (e.title || "予定").trim(),
      start: e.start,
      end: e.end,
      allDay: e.allDay ?? !/T\d{2}:/.test(e.start),
      location: e.location,
      notes: e.notes,
      confidence: 0.9,
      source,
    });
  }
  return out;
}

// LLMの出力からJSON本体を頑健に取り出す
function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : content;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSONが見つかりません");
  return JSON.parse(body.slice(start, end + 1));
}

export async function parseWithLLM(
  text: string,
  source: EventSource,
  now: Date = new Date(),
  onProgress?: LoadProgress,
): Promise<ParseResult> {
  const engine = await ensureEngine(onProgress);
  const reply = await engine.chat.completions.create({
    messages: [{ role: "user", content: buildPrompt(text, now) }],
    temperature: 0,
    max_tokens: 600,
  });
  const content = reply.choices[0]?.message?.content ?? "";
  const json = extractJson(content);
  const events = coerceEvents(json, source);
  if (events.length === 0) {
    return { events: [], engine: "llm", warnings: ["予定を抽出できませんでした"] };
  }
  return { events, engine: "llm" };
}
