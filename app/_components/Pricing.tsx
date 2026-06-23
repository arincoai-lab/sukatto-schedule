import TryButton from "./TryButton";

// 料金: 無料で使える + 買い切りPro（応援価格）。アプリ内のゲートと一致させる。

export default function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="wrap">
        <span className="eyebrow">料金</span>
        <h2 className="section-title">無料で始めて、気に入ったらPro。</h2>
        <p className="lead">
          まずは無料で全部の入力方法を試せます。もっと使いたくなったら、買い切りのProで無制限に。月額はありません。
        </p>
        <div className="price-grid">
          <div className="glass price">
            <div className="tier">無料</div>
            <div className="amount">
              ¥0
            </div>
            <ul>
              <li>音声・写真・手入力すべて使える</li>
              <li>3カレンダーへの同時登録</li>
              <li>クイック登録テンプレ 5種類まで</li>
              <li>音声入力 1日3回まで</li>
            </ul>
            <div style={{ marginTop: 20 }}>
              <TryButton from="pricing_free" label="無料で使ってみる" />
            </div>
          </div>

          <div className="glass price pro">
            <span className="badge">買い切り</span>
            <div className="tier">Pro</div>
            <div className="amount">
              応援価格 <small>／ 月額なし</small>
            </div>
            <ul>
              <li>音声入力もテンプレも無制限</li>
              <li>無料の全機能をそのまま</li>
              <li>個人開発を応援していただけます</li>
              <li>アプリ内からいつでも解除できます</li>
            </ul>
            <div style={{ marginTop: 20 }}>
              <TryButton from="pricing_pro" variant="ghost" label="アプリで詳しく見る" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
