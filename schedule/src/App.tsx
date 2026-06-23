import { useCallback, useEffect, useState } from "react";
import type { ParseResult, ParsedEvent, CalendarEvent } from "./types";
import { loadSettings, saveSettings, type AppSettings } from "./store/settings";
import { parseEvent } from "./parse";
import {
  ensureToken,
  getAccessToken,
  hasValidToken,
  requestToken,
  signOut,
} from "./calendar/google-auth";
import {
  insertEvent,
  listEventsRange,
  updateEvent,
  deleteEvent,
} from "./calendar/google-events";
import {
  ensureOutlookToken,
  getOutlookAccessToken,
  hasOutlookValidToken,
  requestOutlookToken,
  outlookSignOut,
} from "./calendar/outlook-auth";
import {
  insertOutlookEvent,
  listOutlookEventsRange,
  updateOutlookEvent,
  deleteOutlookEvent,
} from "./calendar/outlook-events";
import { fetchIcsSource } from "./calendar/ics";
import { loadIcloudCred, hasIcloudCred, clearIcloudCred } from "./calendar/icloud-cred";
import {
  insertIcloudEvent,
  updateIcloudEvent,
  deleteIcloudEvent,
  listIcloudEventsRange,
} from "./calendar/caldav-events";
import AgendaView from "./calendar/AgendaView";
import MonthView from "./calendar/MonthView";
import EventConfirm from "./confirm/EventConfirm";
import EventEdit from "./confirm/EventEdit";
import QuickAdd from "./input/QuickAdd";
import VoiceCapture, { isVoiceSupported } from "./input/VoiceCapture";
import UpgradePrompt from "./pro/UpgradePrompt";
import { canUseVoice, recordVoiceUse } from "./store/pro";
import { track, EVENTS } from "./util/analytics";
import PhotoCapture from "./input/PhotoCapture";
import SettingsPanel from "./SettingsPanel";
import TemplateBar from "./templates/TemplateBar";
import ConnectionBar, { type ConnService } from "./calendar/ConnectionBar";
import { buildEventFromTemplate } from "./templates/build";
import { applyTheme } from "./util/theme";
import type { EventSource, EventTemplate } from "./types";

type Modal = "none" | "voice" | "photo" | "quick" | "settings";

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [connected, setConnected] = useState(false);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [icloudConnected, setIcloudConnected] = useState(false);
  const [agenda, setAgenda] = useState<CalendarEvent[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [icsWarnings, setIcsWarnings] = useState<string[]>([]);

  // 表示モード（リスト / 月カレンダー）
  const [viewMode, setViewMode] = useState<"agenda" | "month">("agenda");
  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date());
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  const [modal, setModal] = useState<Modal>("none");
  // 無料上限に達したときの買い切りPro案内（reason=どの機能で当たったか）
  const [upgrade, setUpgrade] = useState<{ title: string; reason: "voice" | "template" } | null>(
    null,
  );
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState<string | null>(null); // 進捗テキスト
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 既存予定の編集（Google / Outlook）
  const [editing, setEditing] = useState<ParsedEvent | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<
    "google" | "outlook" | "icloud" | null
  >(null);
  const [editBusy, setEditBusy] = useState(false);

  // 作成イベントへ既定リマインダーを付与（確認UIにも反映される）
  const withDefaultReminder = useCallback(
    (events: ParsedEvent[]): ParsedEvent[] =>
      events.map((e) => ({
        ...e,
        reminderMin: e.reminderMin ?? settings.defaultReminderMin,
      })),
    [settings.defaultReminderMin],
  );

  // Google + ICS を指定期間でまとめて取得（リスト/月表示で共用）
  const loadRange = useCallback(
    async (start: Date, end: Date) => {
      const token = getAccessToken();
      const oToken = getOutlookAccessToken();
      const all: CalendarEvent[] = [];
      const warns: string[] = [];
      if (token) {
        // 書き込み先(複数)のすべてのGoogleカレンダーから取得
        const gResults = await Promise.allSettled(
          settings.writeCalendarIds.map((cid) => listEventsRange(token, cid, start, end)),
        );
        gResults.forEach((r, i) => {
          if (r.status === "fulfilled") {
            all.push(
              ...r.value.map((e) => ({
                ...e,
                calendarSummary: e.calendarSummary ?? settings.writeCalendarIds[i],
              })),
            );
          } else {
            warns.push(`Googleカレンダー「${settings.writeCalendarIds[i]}」の取得に失敗`);
          }
        });
        setConnected(true);
      }
      // Outlook 側も並列取得
      if (oToken && settings.outlookWriteCalendarIds.length > 0) {
        const oResults = await Promise.allSettled(
          settings.outlookWriteCalendarIds.map((cid) =>
            listOutlookEventsRange(oToken, cid, start, end),
          ),
        );
        oResults.forEach((r, i) => {
          if (r.status === "fulfilled") {
            all.push(
              ...r.value.map((e) => ({
                ...e,
                calendarSummary: e.calendarSummary ?? "Outlook",
              })),
            );
          } else {
            warns.push(`Outlookカレンダー「${settings.outlookWriteCalendarIds[i]}」の取得に失敗`);
          }
        });
        setOutlookConnected(true);
      }
      // iCloud(CalDAV) も並列取得
      const icloudCred = loadIcloudCred();
      if (icloudCred && settings.icloudWriteCalendarUrls.length > 0) {
        const calName = (url: string) =>
          settings.icloudCalendars.find((c) => c.url === url)?.displayName ?? "iCloud";
        const iResults = await Promise.allSettled(
          settings.icloudWriteCalendarUrls.map((url) =>
            listIcloudEventsRange(icloudCred, url, calName(url), start, end),
          ),
        );
        iResults.forEach((r, i) => {
          if (r.status === "fulfilled") all.push(...r.value);
          else
            warns.push(
              `iCloudカレンダー「${settings.icloudCalendars[i]?.displayName ?? ""}」の取得に失敗`,
            );
        });
        setIcloudConnected(true);
      }
      const results = await Promise.allSettled(
        settings.icsSources.map((s) => fetchIcsSource(s, start, end)),
      );
      results.forEach((r, i) => {
        if (r.status === "fulfilled") all.push(...r.value);
        else warns.push(`「${settings.icsSources[i].label}」の取得に失敗しました`);
      });
      all.sort((a, b) => a.start.localeCompare(b.start));
      return { events: all, warnings: warns };
    },
    [
      settings.writeCalendarIds,
      settings.outlookWriteCalendarIds,
      settings.icloudWriteCalendarUrls,
      settings.icloudCalendars,
      settings.icsSources,
    ],
  );

  const refreshAgenda = useCallback(async () => {
    const token = getAccessToken();
    const hasIcs = settings.icsSources.length > 0;
    const hasIcloud = hasIcloudCred() && settings.icloudWriteCalendarUrls.length > 0;
    if (!token && !hasIcs && !hasIcloud && !hasOutlookValidToken()) return;
    setLoadingAgenda(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 35 * 86_400_000);
      const { events, warnings } = await loadRange(start, end);
      setAgenda(events);
      setIcsWarnings(warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "予定の取得に失敗しました");
    } finally {
      setLoadingAgenda(false);
    }
  }, [loadRange, settings.icsSources.length, settings.icloudWriteCalendarUrls.length]);

  // 表示中の月（6週グリッド分）の予定を取得
  const refreshMonth = useCallback(async () => {
    const token = getAccessToken();
    const hasIcs = settings.icsSources.length > 0;
    if (!token && !hasIcs) return;
    setMonthLoading(true);
    try {
      const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
      const start = new Date(first);
      start.setDate(1 - first.getDay()); // グリッド先頭(日曜)
      const end = new Date(start.getTime() + 42 * 86_400_000);
      const { events, warnings } = await loadRange(start, end);
      setMonthEvents(events);
      setIcsWarnings(warnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "予定の取得に失敗しました");
    } finally {
      setMonthLoading(false);
    }
  }, [loadRange, monthCursor, settings.icsSources.length]);

  // いずれかの予定ソース(Google/Outlook/iCloud/ICS)があるか
  const hasAnySource =
    connected ||
    outlookConnected ||
    icloudConnected ||
    settings.icsSources.length > 0;

  useEffect(() => {
    if (hasValidToken()) setConnected(true);
    if (hasOutlookValidToken()) setOutlookConnected(true);
    const hasIcloud = hasIcloudCred() && settings.icloudWriteCalendarUrls.length > 0;
    if (hasIcloud) setIcloudConnected(true);
    if (
      hasValidToken() ||
      hasOutlookValidToken() ||
      hasIcloud ||
      settings.icsSources.length > 0
    )
      void refreshAgenda();
  }, [refreshAgenda, settings.icsSources.length, settings.icloudWriteCalendarUrls.length]);

  // テーマ適用（light/dark/system）。system時は端末設定の変化も追従
  useEffect(() => applyTheme(settings.theme), [settings.theme]);

  // 起動を1回だけ計測（個人情報なし）
  useEffect(() => {
    track(EVENTS.appOpened);
  }, []);

  // 月表示の時は表示月に応じて取得
  useEffect(() => {
    if (viewMode !== "month") return;
    if (
      hasValidToken() ||
      hasOutlookValidToken() ||
      (hasIcloudCred() && settings.icloudWriteCalendarUrls.length > 0) ||
      settings.icsSources.length > 0
    )
      void refreshMonth();
  }, [viewMode, refreshMonth, settings.icsSources.length, settings.icloudWriteCalendarUrls.length]);

  const connect = async () => {
    setError(null);
    if (!settings.googleClientId) {
      setModal("settings");
      setError("先にGoogle クライアントIDを設定してください。");
      return;
    }
    try {
      await requestToken(settings.googleClientId);
      setConnected(true);
      await refreshAgenda();
      if (viewMode === "month") await refreshMonth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google接続に失敗しました");
    }
  };

  const connectOutlook = async () => {
    setError(null);
    if (!settings.outlookClientId) {
      setModal("settings");
      setError("先にMicrosoft クライアントIDを設定してください。");
      return;
    }
    try {
      await requestOutlookToken(settings.outlookClientId);
      setOutlookConnected(true);
      await refreshAgenda();
      if (viewMode === "month") await refreshMonth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Outlook接続に失敗しました");
    }
  };

  // 入力テキスト → 解析 → 確認UI
  const runParse = useCallback(
    async (text: string, source: EventSource) => {
      setModal("none");
      setError(null);
      setParsing("解析中…");
      try {
        const result = await parseEvent(text, {
          source,
          preferLLM: settings.preferLLM,
          defaultDurationMin: settings.defaultDurationMin,
          onLlmProgress: (r) =>
            setParsing(
              r.progress < 1
                ? `AIモデル準備中… ${Math.round(r.progress * 100)}%`
                : "解析中…",
            ),
        });
        if (result.events.length === 0) {
          setError(result.warnings?.join(" ") ?? "予定を抽出できませんでした");
          return;
        }
        setParseResult({ ...result, events: withDefaultReminder(result.events) });
      } catch (err) {
        setError(err instanceof Error ? err.message : "解析に失敗しました");
      } finally {
        setParsing(null);
      }
    },
    [settings.preferLLM, settings.defaultDurationMin, withDefaultReminder],
  );

  // Google + Outlook の選択カレンダー全てへ同時登録し、表示を更新。
  // 1つでも失敗があれば集約してエラーとして投げる（成功分はGoogle/Outlookに残る）。
  const registerEvents = useCallback(
    async (events: ParsedEvent[]) => {
      const gTargets = settings.writeCalendarIds.length > 0
        ? settings.writeCalendarIds
        : [settings.defaultCalendarId || "primary"];
      const oTargets = settings.outlookWriteCalendarIds;
      const wantOutlook = oTargets.length > 0 && settings.outlookClientId;
      const iTargets = settings.icloudWriteCalendarUrls;
      const icloudCred = iTargets.length > 0 ? loadIcloudCred() : null;

      const gToken = await ensureToken(settings.googleClientId);
      const oToken = wantOutlook
        ? await ensureOutlookToken(settings.outlookClientId)
        : null;

      const icloudName = (url: string) =>
        settings.icloudCalendars.find((c) => c.url === url)?.displayName ?? "iCloud";

      const failures: string[] = [];
      for (const ev of events) {
        const ops: Promise<unknown>[] = [
          ...gTargets.map((cid) => insertEvent(gToken, cid, ev)),
          ...(oToken ? oTargets.map((cid) => insertOutlookEvent(oToken, cid, ev)) : []),
          ...(icloudCred ? iTargets.map((url) => insertIcloudEvent(icloudCred, url, ev)) : []),
        ];
        const labels = [
          ...gTargets.map((c) => `Google:${c}`),
          ...(oToken ? oTargets.map((c) => `Outlook:${c.slice(0, 8)}`) : []),
          ...(icloudCred ? iTargets.map((u) => `iCloud:${icloudName(u)}`) : []),
        ];
        const results = await Promise.allSettled(ops);
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            failures.push(`${ev.title} → ${labels[i]}: ${String(r.reason).slice(0, 80)}`);
          }
        });
      }
      if (failures.length > 0) {
        throw new Error(`一部のカレンダー登録に失敗: ${failures.join("; ")}`);
      }
      setConnected(true);
      if (wantOutlook) setOutlookConnected(true);
      if (icloudCred) setIcloudConnected(true);
      await refreshAgenda();
      if (viewMode === "month") await refreshMonth();
    },
    [
      settings.googleClientId,
      settings.writeCalendarIds,
      settings.defaultCalendarId,
      settings.outlookClientId,
      settings.outlookWriteCalendarIds,
      settings.icloudWriteCalendarUrls,
      settings.icloudCalendars,
      refreshAgenda,
      refreshMonth,
      viewMode,
    ],
  );

  // 確認後 → Googleカレンダーへ登録
  const confirmEvents = async (events: ParsedEvent[]) => {
    setSaving(true);
    setError(null);
    try {
      await registerEvents(events);
      track(EVENTS.eventRegistered, { count: events.length });
      setParseResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // クイック登録: 確認画面をスキップして即登録（登録時に時間調整した値を反映）
  const pickTemplate = async (
    t: EventTemplate,
    dateStr: string,
    override?: { startTime: string; durationMin: number },
  ) => {
    const ev = buildEventFromTemplate(t, dateStr, settings.defaultDurationMin, override);
    setError(null);
    setParsing(`「${t.label}」を登録中…`);
    try {
      await registerEvents(withDefaultReminder([ev]));
      track(EVENTS.eventRegistered, { count: 1, via: "template" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setParsing(null);
    }
  };

  // アジェンダの予定をタップ → 編集モーダルへ。Google/Outlookのみ編集可。
  // 編集/削除は由来カレンダー(e.calendarId)とprovider別のAPIへルーティング。
  const onSelectEvent = (e: CalendarEvent) => {
    if (e.provider === "ics") return; // 読み取り専用
    setError(null);
    // iCloudはイベント絶対URL(href)が編集/削除の宛先。繰り返しは親URLを使う。
    setEditingId(e.provider === "icloud" ? (e.href ?? e.id) : e.id);
    setEditingCalendarId(e.calendarId ?? settings.defaultCalendarId);
    setEditingProvider(e.provider);
    setEditing({
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      location: e.location,
      confidence: 1,
      source: "manual",
      reminderMin: settings.defaultReminderMin,
    });
  };

  const clearEditState = () => {
    setEditing(null);
    setEditingId(null);
    setEditingCalendarId(null);
    setEditingProvider(null);
  };

  const saveEdit = async (updated: ParsedEvent) => {
    if (!editingId || !editingCalendarId || !editingProvider) return;
    setEditBusy(true);
    setError(null);
    try {
      if (editingProvider === "google") {
        const token = await ensureToken(settings.googleClientId);
        await updateEvent(token, editingCalendarId, editingId, updated);
      } else if (editingProvider === "outlook") {
        const token = await ensureOutlookToken(settings.outlookClientId);
        await updateOutlookEvent(token, editingCalendarId, editingId, updated);
      } else {
        const cred = loadIcloudCred();
        if (!cred) throw new Error("iCloud未接続です");
        await updateIcloudEvent(cred, editingId, updated); // editingId = href
      }
      clearEditState();
      await refreshAgenda();
      if (viewMode === "month") await refreshMonth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setEditBusy(false);
    }
  };

  const deleteEditing = async () => {
    if (!editingId || !editingCalendarId || !editingProvider) return;
    setEditBusy(true);
    setError(null);
    try {
      if (editingProvider === "google") {
        const token = await ensureToken(settings.googleClientId);
        await deleteEvent(token, editingCalendarId, editingId);
      } else if (editingProvider === "outlook") {
        const token = await ensureOutlookToken(settings.outlookClientId);
        await deleteOutlookEvent(token, editingCalendarId, editingId);
      } else {
        const cred = loadIcloudCred();
        if (!cred) throw new Error("iCloud未接続です");
        await deleteIcloudEvent(cred, editingId); // editingId = href
      }
      clearEditState();
      await refreshAgenda();
      if (viewMode === "month") await refreshMonth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setEditBusy(false);
    }
  };

  const onSaveSettings = (s: AppSettings) => {
    setSettings(s);
    saveSettings(s);
    setModal("none");
    void refreshAgenda();
  };

  // 接続中サービス（上部の接続ステータス表示用）。切断ロジックも同梱。
  const connServices: ConnService[] = [];
  if (connected) {
    connServices.push({
      key: "google",
      label: "Google",
      color: "#4285F4",
      onDisconnect: () => {
        signOut();
        setConnected(false);
        setAgenda([]);
        setMonthEvents([]);
      },
    });
  }
  if (outlookConnected) {
    connServices.push({
      key: "outlook",
      label: "Outlook",
      color: "#0078D4",
      onDisconnect: () => {
        outlookSignOut();
        setOutlookConnected(false);
        void refreshAgenda();
      },
    });
  }
  if (icloudConnected) {
    connServices.push({
      key: "icloud",
      label: "iCloud",
      color: "#34c759",
      onDisconnect: () => {
        clearIcloudCred();
        setIcloudConnected(false);
        const next = { ...settings, icloudCalendars: [], icloudWriteCalendarUrls: [] };
        setSettings(next);
        saveSettings(next);
        void refreshAgenda();
      },
    });
  }

  return (
    <>
      <header className="app-header">
        <h1>Skatto Schedular</h1>
        <button className="link-btn" onClick={() => setModal("settings")}>
          設定
        </button>
      </header>

      <main className="app-main">
        {error && <div className="banner error">{error}</div>}
        {icsWarnings.map((w, i) => (
          <div key={i} className="banner warn">
            {w}
          </div>
        ))}
        {parsing && (
          <div className="banner info">
            <span className="spinner" />
            {parsing}
          </div>
        )}

        {!connected && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="title">Googleカレンダーに接続</div>
            <div className="meta" style={{ marginBottom: 12 }}>
              予定の保存先です。接続すると直近の予定も表示されます。
            </div>
            <button className="btn primary" onClick={connect} style={{ width: "100%" }}>
              Googleに接続
            </button>
          </div>
        )}

        {settings.outlookClientId && !outlookConnected && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="title">Outlookカレンダーに接続</div>
            <div className="meta" style={{ marginBottom: 12 }}>
              仕事用カレンダー(Microsoft 365)にも同時登録できます。
            </div>
            <button className="btn primary" onClick={connectOutlook} style={{ width: "100%" }}>
              Outlookに接続
            </button>
          </div>
        )}

        <ConnectionBar services={connServices} />

        {(hasAnySource || connected) && (
          <div className="view-toggle">
            <button
              className={viewMode === "agenda" ? "active" : ""}
              onClick={() => setViewMode("agenda")}
            >
              リスト
            </button>
            <button
              className={viewMode === "month" ? "active" : ""}
              onClick={() => setViewMode("month")}
            >
              カレンダー
            </button>
          </div>
        )}

        <div className="content">
          {viewMode === "agenda" ? (
            <AgendaView
              events={agenda}
              loading={loadingAgenda}
              connected={hasAnySource}
              onSelect={onSelectEvent}
            />
          ) : (
            <MonthView
              events={monthEvents}
              monthCursor={monthCursor}
              loading={monthLoading}
              onPrevMonth={() =>
                setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
              }
              onNextMonth={() =>
                setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
              }
              onToday={() => setMonthCursor(new Date())}
              onSelectEvent={onSelectEvent}
            />
          )}
        </div>
      </main>

      {/* 入力ゾーン: クイック登録ストリップ + 話す/撮る/打つ を画面下にまとめて親指圏に。 */}
      <div className="input-zone">
        <TemplateBar templates={settings.templates} onPick={pickTemplate} />
        <nav className="input-dock">
          <button
            className="dock-btn"
            onClick={() => {
              if (!canUseVoice(settings.isPro)) {
                track(EVENTS.voiceLimitHit);
                setUpgrade({ title: "音声入力は無料で1日3回までです。", reason: "voice" });
                return;
              }
              setModal("voice");
            }}
            disabled={!isVoiceSupported()}
            title={isVoiceSupported() ? "" : "この端末は音声入力に非対応"}
          >
            <span className="ico">🎙️</span>
            話す
          </button>
          <button className="dock-btn" onClick={() => setModal("photo")}>
            <span className="ico">📷</span>
            撮る
          </button>
          <button className="dock-btn primary" onClick={() => setModal("quick")}>
            <span className="ico">✏️</span>
            打つ
          </button>
        </nav>
      </div>

      {modal === "quick" && (
        <QuickAdd onCancel={() => setModal("none")} onSubmit={(t) => runParse(t, "manual")} />
      )}
      {modal === "voice" && (
        <VoiceCapture
          onCancel={() => setModal("none")}
          onResult={(t) => {
            if (!settings.isPro) recordVoiceUse();
            void runParse(t, "voice");
          }}
        />
      )}
      {modal === "photo" && (
        <PhotoCapture onCancel={() => setModal("none")} onText={(t) => runParse(t, "photo")} />
      )}
      {modal === "settings" && (
        <SettingsPanel
          settings={settings}
          token={getAccessToken()}
          outlookToken={getOutlookAccessToken()}
          onSave={onSaveSettings}
          onUnlockPro={() => {
            const next = { ...settings, isPro: true };
            setSettings(next);
            saveSettings(next);
          }}
          onClose={() => setModal("none")}
        />
      )}
      {upgrade && (
        <UpgradePrompt
          title={upgrade.title}
          reason={upgrade.reason}
          onOpenSettings={() => {
            setUpgrade(null);
            setModal("settings");
          }}
          onClose={() => setUpgrade(null)}
        />
      )}

      {parseResult && (
        <EventConfirm
          events={parseResult.events}
          warnings={parseResult.warnings}
          saving={saving}
          onCancel={() => setParseResult(null)}
          onConfirm={confirmEvents}
        />
      )}

      {editing && (
        <EventEdit
          event={editing}
          busy={editBusy}
          onCancel={clearEditState}
          onSave={saveEdit}
          onDelete={deleteEditing}
        />
      )}
    </>
  );
}
