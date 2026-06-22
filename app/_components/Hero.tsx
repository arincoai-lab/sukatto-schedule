import TryButton from "./TryButton";

// ヒーロー: 価値訴求 + 「話す→登録される瞬間」の実演カード。
// デモ動画ができたら .demo-card 内を差し替え可能（構造はそのまま）。

export default function Hero() {
  return (
    <header className="hero">
      <div className="wrap hero-grid">
        <div className="reveal">
          <span className="eyebrow">音声・写真・手入力 → 1タップ</span>
          <h1>
            予定を<span className="grad">話すだけ</span>で、<br />
            カレンダーに入る。
          </h1>
          <p className="sub">
            「明日15時 歯医者」と話す、紙の予定表を撮る、サッと打つ。
            あとは1タップ。Google・Outlook・iCloudへ同時に登録できます。
          </p>
          <div className="hero-cta">
            <TryButton from="hero" label="無料で使ってみる" />
            <a className="btn btn-ghost" href="#how">
              使い方を見る
            </a>
          </div>
          <p className="hero-note">
            インストール不要・端末内AIで処理・予定はサーバーに保存しません。
          </p>
        </div>

        <div className="glass demo-card reveal" style={{ animationDelay: "0.12s" }}>
          <div className="demo-mic">
            <span className="pulse" aria-hidden />
            聞いています…
          </div>
          <p className="demo-said">「明日の15時から歯医者」</p>
          <div className="demo-arrow">▼ 自動で予定に変換 ▼</div>
          <div className="event-chip">
            <div className="when">
              15:00
              <small>明日</small>
            </div>
            <div className="what">
              歯医者
              <small>15:00 – 16:00</small>
            </div>
            <span className="check" aria-hidden>
              ✓
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
