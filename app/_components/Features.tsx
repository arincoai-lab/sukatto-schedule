// 3つの入力方法。アプリの実機能（音声/写真OCR/手入力・テンプレ）に対応。

const FEATURES = [
  {
    ico: "🎙️",
    title: "話す",
    body: "「来週火曜の午後3時に歯医者」と話すだけ。端末内の音声認識＆AIが日時・タイトルを抽出します。",
  },
  {
    ico: "📷",
    title: "撮る",
    body: "紙の月間予定表やホワイトボードを撮影。OCR＋AIが複数の予定をまとめて読み取ります。",
  },
  {
    ico: "✏️",
    title: "打つ",
    body: "サッと一行入力、またはよく使う予定はテンプレを1タップ。「出勤」「ジム」も瞬時に登録。",
  },
];

export default function Features() {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <span className="eyebrow">3つの入力</span>
        <h2 className="section-title">いちばんラクな方法で、予定を入れる。</h2>
        <p className="lead">
          手で日時を打ち込む手間をなくすために作りました。話す・撮る・打つ、その日の気分で選べます。
        </p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass feature">
              <div className="ico" aria-hidden>
                {f.ico}
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
