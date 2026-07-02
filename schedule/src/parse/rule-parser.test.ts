import { describe, expect, it } from "vitest";
import { parseWithRules } from "./rule-parser";

// 基準時刻はローカル時刻で固定（toIso はローカル成分ベースのためTZ非依存で決定的）
const NOW = new Date(2026, 6, 2, 9, 0, 0); // 2026-07-02 09:00

describe("parseWithRules", () => {
  it("「明日15時」を時刻付き予定として解析する", () => {
    const r = parseWithRules("明日15時 歯医者", "manual", NOW, 60);
    expect(r.engine).toBe("rule");
    expect(r.events).toHaveLength(1);
    const e = r.events[0];
    expect(e.start).toBe("2026-07-03T15:00:00+09:00");
    expect(e.end).toBe("2026-07-03T16:00:00+09:00");
    expect(e.allDay).toBe(false);
    expect(e.title).toBe("歯医者");
  });

  it("時刻が無い場合は終日予定になる", () => {
    const r = parseWithRules("明日 休み", "manual", NOW, 60);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].allDay).toBe(true);
    expect(r.events[0].start).toBe("2026-07-03");
  });

  it("@形式の場所を抽出しタイトルから除去する", () => {
    const r = parseWithRules("明日15時 打ち合わせ @渋谷", "manual", NOW, 60);
    expect(r.events[0].location).toBe("渋谷");
    expect(r.events[0].title).toBe("打ち合わせ");
  });

  it("正規表現の特殊文字を含む場所でも落ちない", () => {
    const r = parseWithRules("明日15時 打ち合わせ @カフェ(2F", "manual", NOW, 60);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].location).toBe("カフェ(2F");
  });

  it("複数行入力から複数の予定を抽出する", () => {
    const r = parseWithRules("7月10日15時 歯医者\n7月11日18時 飲み会", "manual", NOW, 60);
    expect(r.events).toHaveLength(2);
  });

  it("日時を認識できない場合は低確信度の終日候補にフォールバックする", () => {
    const r = parseWithRules("ただのメモ", "manual", NOW, 60);
    expect(r.events).toHaveLength(1);
    expect(r.events[0].allDay).toBe(true);
    expect(r.events[0].confidence).toBeLessThan(0.5);
    expect(r.warnings?.length).toBeGreaterThan(0);
  });

  it("空入力は警告のみ返す", () => {
    const r = parseWithRules("  ", "manual", NOW, 60);
    expect(r.events).toHaveLength(0);
    expect(r.warnings?.length).toBeGreaterThan(0);
  });
});
