import { PRO_PURCHASE_URL } from "../store/pro";
import { track, EVENTS } from "../util/analytics";

// 無料の上限に達したときに出す、控えめな買い切りProの案内。
// 体験を止めず「続けるならPro」を伝える。決済はGumroad等の購入ページに委譲。

interface Props {
  title: string; // 例: 「音声入力は無料で1日3回までです」
  reason: "voice" | "template";
  onOpenSettings: () => void; // 設定（ライセンスキー入力）へ
  onClose: () => void;
}

export default function UpgradePrompt({ title, reason, onOpenSettings, onClose }: Props) {
  const buy = () => {
    track(EVENTS.proCtaClicked, { from: reason });
    window.open(PRO_PURCHASE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>Proで無制限に</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "0 0 8px" }}>{title}</p>
        <ul style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0 0 14px", paddingLeft: 18 }}>
          <li>音声入力もテンプレも無制限</li>
          <li>買い切り（応援価格）・月額なし</li>
          <li>個人開発を応援していただけます</li>
        </ul>
        <div className="btn-row">
          <button className="btn ghost" onClick={onClose}>
            あとで
          </button>
          <button className="btn primary" onClick={buy}>
            Proにする（買い切り）
          </button>
        </div>
        <button
          className="link-btn"
          style={{ display: "block", margin: "10px auto 0" }}
          onClick={onOpenSettings}
        >
          購入済み：ライセンスキーを入力
        </button>
      </div>
    </div>
  );
}
