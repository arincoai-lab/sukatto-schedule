// 接続中のカレンダーを一目で分かるように表示する。各サービスの色ドット＋「接続中」。
// 切断は各チップ内の小さなボタンから（誤操作しにくいよう控えめに配置）。

export interface ConnService {
  key: string;
  label: string; // 例: "Google"
  color: string; // サービスの識別色
  onDisconnect: () => void;
}

export default function ConnectionBar({ services }: { services: ConnService[] }) {
  if (services.length === 0) return null;
  return (
    <div className="conn-bar" role="status" aria-label="接続中のカレンダー">
      {services.map((s) => (
        <span key={s.key} className="conn-chip">
          <span className="conn-dot" style={{ background: s.color }} aria-hidden />
          <span className="conn-name">{s.label}</span>
          <span className="conn-state">接続中</span>
          <button
            className="conn-off"
            onClick={s.onDisconnect}
            aria-label={`${s.label}を切断`}
            title="切断"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
