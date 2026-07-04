import { useEffect, useState } from "react";
import type { AppSettings } from "./store/settings";
import type { IcsSource } from "./calendar/ics";
import { isWebGpuAvailable } from "./parse";
import { listCalendars } from "./calendar/google-events";
import { listOutlookCalendars } from "./calendar/outlook-events";
import IcloudSection from "./IcloudSection";
import TemplatesEditor from "./templates/TemplatesEditor";
import { FREE_TEMPLATE_LIMIT, PRO_PURCHASE_URL, verifyLicense } from "./store/pro";
import { saveLicense } from "./store/license";
import { track, EVENTS } from "./util/analytics";

// 設定パネル: GoogleクライアントID（公開値）、書き込み先カレンダー、既定所要時間、
// 既定の通知、LLM利用可否、外部カレンダー(ICS購読)、よく使う予定テンプレ。

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: "1rem",
};

interface Props {
  settings: AppSettings;
  token: string | null;
  outlookToken: string | null;
  onSave: (s: AppSettings) => void;
  onUnlockPro: () => void; // ライセンス検証成功時に即時永続化（モーダルは閉じない）
  onClose: () => void;
}

function IcsSourcesEditor({
  sources,
  onChange,
}: {
  sources: IcsSource[];
  onChange: (s: IcsSource[]) => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    if (!url.trim()) return;
    const next: IcsSource = {
      id: crypto.randomUUID(),
      label: label.trim() || "外部カレンダー",
      url: url.trim(),
    };
    onChange([...sources, next]);
    setLabel("");
    setUrl("");
  };

  return (
    <div>
      {sources.map((s) => (
        <div
          className="card"
          key={s.id}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ overflow: "hidden" }}>
            <div className="title" style={{ fontSize: "0.92rem" }}>
              {s.label}
            </div>
            <div className="meta" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.url}
            </div>
          </div>
          <button
            className="link-btn"
            style={{ color: "var(--danger)", flexShrink: 0 }}
            onClick={() => onChange(sources.filter((x) => x.id !== s.id))}
          >
            削除
          </button>
        </div>
      ))}
      <div className="field">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="名前（例: 仕事 / 家族）"
        />
      </div>
      <div className="field">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… または webcal://… (.ics)"
        />
      </div>
      <button className="btn" style={{ width: "100%" }} disabled={!url.trim()} onClick={add}>
        ＋ ソースを追加
      </button>
    </div>
  );
}

// 買い切りProの状態表示・購入導線・ライセンスキー解除。
function ProSection({ isPro, onUnlock }: { isPro: boolean; onUnlock: () => void }) {
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPro) {
    return (
      <div className="card" style={{ marginBottom: 4 }}>
        <div className="title" style={{ fontSize: "0.95rem" }}>✓ Pro 有効</div>
        <div className="meta">音声入力・テンプレが無制限です。ご支援ありがとうございます。</div>
      </div>
    );
  }

  const unlock = async () => {
    setBusy(true);
    setStatus(null);
    const result = await verifyLicense(key);
    setBusy(false);
    if (result.valid) {
      // キーを端末に保存し、以後の起動時再検証（返金・係争対策）に使う
      saveLicense(key.trim());
      track(EVENTS.proUnlocked);
      onUnlock();
    } else {
      setStatus(result.error ?? "ライセンスを確認できませんでした");
    }
  };

  return (
    <div>
      <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: "0 0 10px" }}>
        無料プランはテンプレ{FREE_TEMPLATE_LIMIT}種類・音声入力1日3回まで。Proなら全部無制限（買い切り・月額なし）。
      </p>
      <button
        className="btn primary"
        style={{ width: "100%", marginBottom: 12 }}
        onClick={() => {
          track(EVENTS.proCtaClicked, { from: "settings" });
          window.open(PRO_PURCHASE_URL, "_blank", "noopener,noreferrer");
        }}
      >
        Proにする（買い切り）
      </button>
      <div className="field">
        <label>購入済みの方：ライセンスキー</label>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="購入時に発行されたキーを貼り付け"
        />
      </div>
      {status && <div className="banner error" style={{ marginBottom: 8 }}>{status}</div>}
      <button
        className="btn"
        style={{ width: "100%" }}
        disabled={!key.trim() || busy}
        onClick={unlock}
      >
        {busy ? "確認しています…" : "このキーでProを有効にする"}
      </button>
    </div>
  );
}

export default function SettingsPanel({
  settings,
  token,
  outlookToken,
  onSave,
  onUnlockPro,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<AppSettings>(settings);

  const handleProUnlock = () => {
    setDraft((d) => ({ ...d, isPro: true }));
    onUnlockPro();
  };
  const [tab, setTab] = useState<"calendars" | "input" | "display">("input");
  const [calendars, setCalendars] = useState<{ id: string; summary: string }[]>([]);
  const [outlookCalendars, setOutlookCalendars] = useState<{ id: string; summary: string }[]>(
    [],
  );
  const webgpu = isWebGpuAvailable();

  useEffect(() => {
    if (!token) return;
    listCalendars(token)
      .then((list) => setCalendars(list.map((c) => ({ id: c.id, summary: c.summary }))))
      .catch(() => setCalendars([]));
  }, [token]);

  useEffect(() => {
    if (!outlookToken) return;
    listOutlookCalendars(outlookToken)
      .then((list) => setOutlookCalendars(list.map((c) => ({ id: c.id, summary: c.summary }))))
      .catch(() => setOutlookCalendars([]));
  }, [outlookToken]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal modal-fixed">
        <h2>設定</h2>

        <div className="view-toggle" style={{ marginTop: 0 }}>
          <button
            className={tab === "calendars" ? "active" : ""}
            onClick={() => setTab("calendars")}
          >
            連携
          </button>
          <button className={tab === "input" ? "active" : ""} onClick={() => setTab("input")}>
            入力
          </button>
          <button
            className={tab === "display" ? "active" : ""}
            onClick={() => setTab("display")}
          >
            表示
          </button>
        </div>

        <div className="modal-body">
        {tab === "calendars" && (
        <>
        <div className="field">
          <label>Google OAuth クライアントID（公開値・秘密鍵ではありません）</label>
          <input
            value={draft.googleClientId}
            onChange={(e) => setDraft({ ...draft, googleClientId: e.target.value })}
            placeholder="xxxxx.apps.googleusercontent.com"
          />
        </div>

        <div className="field">
          <label>
            書き込み先カレンダー（複数選択可・選んだ全てに同時登録）
          </label>
          {calendars.length > 0 ? (
            <div className="calendar-checklist">
              {calendars.map((c) => {
                const checked = draft.writeCalendarIds.includes(c.id);
                return (
                  <label key={c.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const set = new Set(draft.writeCalendarIds);
                        if (e.target.checked) set.add(c.id);
                        else set.delete(c.id);
                        // 0件にはしない（必ず1つは選択保持）
                        const next = set.size > 0 ? [...set] : [c.id];
                        setDraft({ ...draft, writeCalendarIds: next });
                      }}
                    />
                    <span>{c.summary}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <input
              value={draft.writeCalendarIds[0] ?? "primary"}
              onChange={(e) =>
                setDraft({ ...draft, writeCalendarIds: [e.target.value || "primary"] })
              }
              placeholder="primary"
            />
          )}
          <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 4 }}>
            接続後に Google から自分のカレンダー一覧を取得して表示します。
          </div>
        </div>

        <div className="section-label">Outlook(Microsoft 365) 連携 — 任意</div>

        <div className="field">
          <label>Microsoft OAuth クライアントID（Azure に登録したアプリのID）</label>
          <input
            value={draft.outlookClientId}
            onChange={(e) => setDraft({ ...draft, outlookClientId: e.target.value })}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
          <div style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 4 }}>
            設定すると「Outlookに接続」ボタンが現れます。Azure App登録手順はREADME参照。
          </div>
        </div>

        {outlookCalendars.length > 0 && (
          <div className="field">
            <label>Outlook 書き込み先カレンダー（複数選択可・全てに同時登録）</label>
            <div className="calendar-checklist">
              {outlookCalendars.map((c) => {
                const checked = draft.outlookWriteCalendarIds.includes(c.id);
                return (
                  <label key={c.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const set = new Set(draft.outlookWriteCalendarIds);
                        if (e.target.checked) set.add(c.id);
                        else set.delete(c.id);
                        setDraft({ ...draft, outlookWriteCalendarIds: [...set] });
                      }}
                    />
                    <span>{c.summary}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="section-label">統合閲覧する外部カレンダー（ICS購読）</div>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 10px" }}>
          Outlook等の「公開URL(.ics)」を貼ると、ここで予定を閲覧できます（読み取り専用）。
        </p>
        <IcsSourcesEditor
          sources={draft.icsSources}
          onChange={(icsSources) => setDraft({ ...draft, icsSources })}
        />

        <IcloudSection
          calendars={draft.icloudCalendars}
          writeUrls={draft.icloudWriteCalendarUrls}
          onChange={(icloudCalendars, icloudWriteCalendarUrls) =>
            setDraft({ ...draft, icloudCalendars, icloudWriteCalendarUrls })
          }
        />
        </>
        )}

        {tab === "input" && (
        <>
        <div className="section-label">プラン</div>
        <ProSection isPro={draft.isPro} onUnlock={handleProUnlock} />

        <div className="section-label" style={{ marginTop: 14 }}>よく使う予定テンプレ</div>
        <TemplatesEditor
          templates={draft.templates}
          isPro={draft.isPro}
          onChange={(templates) => setDraft({ ...draft, templates })}
        />

        <div className="field" style={{ marginTop: 14 }}>
          <label>既定の所要時間（分）</label>
          <input
            type="number"
            value={draft.defaultDurationMin}
            onChange={(e) =>
              setDraft({ ...draft, defaultDurationMin: Number(e.target.value) || 60 })
            }
          />
        </div>

        <div className="field">
          <label>既定の通知（Googleカレンダーが全端末で通知）</label>
          <select
            style={selectStyle}
            value={draft.defaultReminderMin}
            onChange={(e) =>
              setDraft({ ...draft, defaultReminderMin: Number(e.target.value) })
            }
          >
            <option value={0}>通知なし</option>
            <option value={10}>10分前</option>
            <option value={30}>30分前</option>
            <option value={60}>1時間前</option>
            <option value={1440}>1日前</option>
          </select>
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={draft.preferLLM}
              disabled={!webgpu}
              onChange={(e) => setDraft({ ...draft, preferLLM: e.target.checked })}
              style={{ width: "auto", marginRight: 6 }}
            />
            端末内AI（WebLLM）で高精度解析を使う
          </label>
          {!webgpu && (
            <div className="banner warn" style={{ marginTop: 8 }}>
              この端末はWebGPU非対応のため、簡易解析（ルールベース）で動作します。
            </div>
          )}
        </div>
        </>
        )}

        {tab === "display" && (
        <div className="field">
          <label>テーマ</label>
          <div className="view-toggle" style={{ margin: 0 }}>
            <button
              className={draft.theme === "light" ? "active" : ""}
              onClick={() => setDraft({ ...draft, theme: "light" })}
            >
              ライト
            </button>
            <button
              className={draft.theme === "dark" ? "active" : ""}
              onClick={() => setDraft({ ...draft, theme: "dark" })}
            >
              ダーク
            </button>
            <button
              className={draft.theme === "system" ? "active" : ""}
              onClick={() => setDraft({ ...draft, theme: "system" })}
            >
              端末設定
            </button>
          </div>
        </div>
        )}
        </div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={onClose}>
            閉じる
          </button>
          <button className="btn primary" onClick={() => onSave(draft)}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
