import type { MLCEngineInterface } from "@mlc-ai/web-llm";
import type { ParsedEvent, ParseResult, EventSource } from "../types";

// 端末内オープンLLM（WebGPU）で自然文/OCRテキストを構造化イベントへ変換。
// 有料API・サーバーは一切使わない。初回のみモデルをDLしブラウザにキャッシュ。

const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

export type LoadProgress = (report: { progress: number; text: string }) => void;

let enginePromise: Promise<MLCEngineInterface> | null = null;

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// エンジンは初回利用時に遅延初期化。WebLLM本体も動的importで初回のみDLする
// （初期バンドルを軽量に保つため）。
export async function ensureEngine(
  onProgress?: LoadProgress,
): Promise<MLCEngineInterface> {
  if (!isWebGpuAvailable()) {
    throw new Error("WebGPU 非対応のため端末内LLMを利用できません");
  }
  if (!enginePromise) {
    enginePromise = (async () => {
      const webllm = await import("@mlc-ai/web-llm");
      return webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (r) =>
          onProgress?.({ progress: r.progress, text: r.text }),
      });
    })();
  }
  return enginePromise;
}

function buildPrompt(text: string, now: Date): string {
  const iso = now.toISOString();
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
  return [
    "あなたは日本語のスケジュール抽出器です。",
    `現在の日時は ${iso}（${weekday}曜日, タイムゾーン JST/+09:00）です。`,
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
