import type { ParseResult, EventSource } from "../types";
import { parseWithRules } from "./rule-parser";
import { isWebGpuAvailable, parseWithLLM, type LoadProgress } from "./llm-parser";

export { isWebGpuAvailable } from "./llm-parser";
export { ensureEngine } from "./llm-parser";
export { imageToText } from "./ocr";

export interface ParseOptions {
  source: EventSource;
  preferLLM: boolean;
  defaultDurationMin: number;
  now?: Date;
  onLlmProgress?: LoadProgress;
}

const CONFIDENT = 0.5;

function isConfident(result: ParseResult): boolean {
  return result.events.length > 0 && result.events.every((e) => e.confidence >= CONFIDENT);
}

// 解析ファサード。各エンジンの強みに合わせて経路を選ぶハイブリッド:
//  - 短文（音声/手動）: chronoのルール解析を優先。高速かつ相対日付に強い。
//    解析が弱い時だけ端末内LLMへエスカレーション。
//  - 写真OCR（雑多・複数予定）: LLMを優先（複数イベント抽出に強い）。失敗時ルールへ。
// LLMはWebGPU可かつ設定ONの時のみ使用。常に最終フォールバックとしてルール解析を持つ。
export async function parseEvent(
  text: string,
  opts: ParseOptions,
): Promise<ParseResult> {
  const now = opts.now ?? new Date();
  const useLLM = opts.preferLLM && isWebGpuAvailable();

  const runRules = () =>
    parseWithRules(text, opts.source, now, opts.defaultDurationMin);
  const runLLM = async () =>
    parseWithLLM(text, opts.source, now, opts.onLlmProgress);

  if (opts.source === "photo") {
    if (useLLM) {
      try {
        const llm = await runLLM();
        if (llm.events.length > 0) return llm;
      } catch (err) {
        console.warn("LLM解析に失敗、ルールベースへフォールバック:", err);
      }
    }
    return runRules();
  }

  // 短文はルール優先
  const rule = runRules();
  if (isConfident(rule) || !useLLM) return rule;

  // ルールが弱い時のみLLMへ
  try {
    const llm = await runLLM();
    if (llm.events.length > 0) return llm;
  } catch (err) {
    console.warn("LLM解析に失敗、ルールベース結果を使用:", err);
  }
  return rule;
}
