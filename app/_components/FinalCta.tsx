import TryButton from "./TryButton";

// 最終CTA。
export default function FinalCta() {
  return (
    <section className="final">
      <div className="wrap">
        <span className="eyebrow" style={{ justifyContent: "center", display: "inline-flex" }}>
          今日から
        </span>
        <h2>予定入力の手間を、ゼロに近づける。</h2>
        <TryButton from="final" label="無料で使ってみる" />
      </div>
    </section>
  );
}
