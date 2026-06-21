import { useState } from "react";
import {
  loadIcloudCred,
  saveIcloudCred,
  clearIcloudCred,
} from "./calendar/icloud-cred";
import { discoverIcloudCalendars } from "./calendar/caldav-client";

// 設定パネルの iCloud(CalDAV) セクション。
// Apple ID ＋ アプリ用パスワードで接続し、書き込み先カレンダーを選ぶ。
// 資格情報は icloud-cred.ts（専用キー）に保存し、設定本体には含めない。

interface IcloudCalendar {
  url: string;
  displayName: string;
}

interface Props {
  calendars: IcloudCalendar[];
  writeUrls: string[];
  onChange: (calendars: IcloudCalendar[], writeUrls: string[]) => void;
}

export default function IcloudSection({ calendars, writeUrls, onChange }: Props) {
  const initial = loadIcloudCred();
  const [appleId, setAppleId] = useState(initial?.appleId ?? "");
  const [appPassword, setAppPassword] = useState(initial?.appPassword ?? "");
  const [connecting, setConnecting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const connect = async () => {
    setErr(null);
    setOkMsg(null);
    if (!appleId.trim() || !appPassword.trim()) {
      setErr("Apple ID とアプリ用パスワードを入力してください。");
      return;
    }
    const cred = { appleId: appleId.trim(), appPassword: appPassword.trim() };
    setConnecting(true);
    try {
      const list = await discoverIcloudCalendars(cred);
      saveIcloudCred(cred);
      // 既存の選択は有効なものだけ残す。未選択なら全部を初期選択にしない（明示選択）。
      const validUrls = new Set(list.map((c) => c.url));
      const keptWrite = writeUrls.filter((u) => validUrls.has(u));
      onChange(list, keptWrite);
      setOkMsg(`接続成功：${list.length}個のカレンダーが見つかりました。`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "接続に失敗しました");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    clearIcloudCred();
    setAppPassword("");
    onChange([], []);
    setOkMsg(null);
    setErr(null);
  };

  const toggle = (url: string, checked: boolean) => {
    const set = new Set(writeUrls);
    if (checked) set.add(url);
    else set.delete(url);
    onChange(calendars, [...set]);
  };

  return (
    <div>
      <div className="section-label">iCloud(Appleカレンダー) 連携 — 任意</div>
      <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 10px" }}>
        Apple は OAuth を提供しないため、
        <a href="https://appleid.apple.com" target="_blank" rel="noopener noreferrer">
          appleid.apple.com
        </a>
        で発行する「<strong>アプリ用パスワード</strong>」を使います（通常のパスワードとは別物）。
        入力情報はこの端末にのみ保存され、iCloud以外へ送信されません。
      </p>

      <div className="field">
        <label>Apple ID（メールアドレス）</label>
        <input
          type="email"
          autoComplete="off"
          value={appleId}
          onChange={(e) => setAppleId(e.target.value)}
          placeholder="example@icloud.com"
        />
      </div>

      <div className="field">
        <label>アプリ用パスワード（xxxx-xxxx-xxxx-xxxx）</label>
        <input
          type="password"
          autoComplete="off"
          value={appPassword}
          onChange={(e) => setAppPassword(e.target.value)}
          placeholder="xxxx-xxxx-xxxx-xxxx"
        />
      </div>

      <button
        className="btn"
        style={{ width: "100%" }}
        disabled={connecting}
        onClick={connect}
      >
        {connecting ? "接続中…" : "接続してカレンダーを取得"}
      </button>

      {err && (
        <div className="banner error" style={{ marginTop: 8 }}>
          {err}
        </div>
      )}
      {okMsg && (
        <div className="banner info" style={{ marginTop: 8 }}>
          {okMsg}
        </div>
      )}

      {calendars.length > 0 && (
        <div className="field" style={{ marginTop: 12 }}>
          <label>iCloud 書き込み先カレンダー（複数選択可・全てに同時登録）</label>
          <div className="calendar-checklist">
            {calendars.map((c) => (
              <label key={c.url} className="check-row">
                <input
                  type="checkbox"
                  checked={writeUrls.includes(c.url)}
                  onChange={(e) => toggle(c.url, e.target.checked)}
                />
                <span>{c.displayName}</span>
              </label>
            ))}
          </div>
          <button
            className="link-btn"
            style={{ color: "var(--danger)", marginTop: 6 }}
            onClick={disconnect}
          >
            iCloud連携を解除
          </button>
        </div>
      )}
    </div>
  );
}
