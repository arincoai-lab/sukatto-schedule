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
import { fetchIcsSource } from "./calendar/ics";
import AgendaView from "./calendar/AgendaView";
import MonthView from "./calendar/MonthView";
import EventConfirm from "./confirm/EventConfirm";
import EventEdit from "./confirm/EventEdit";
import QuickAdd from "./input/QuickAdd";
import VoiceCapture, { isVoiceSupported } from "./input/VoiceCapture";
import PhotoCapture from "./input/PhotoCapture";
import SettingsPanel from "./SettingsPanel";
import TemplateBar from "./templates/TemplateBar";
import { buildEventFromTemplate } from "./templates/build";
import type { EventSource, EventTemplate } from "./types";

type Modal = "none" | "voice" | "photo" | "quick" | "settings";

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [connected, setConnected] = useState(false);
  const [agenda, setAgenda] = useState<CalendarEvent[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [icsWarnings, setIcsWarnings] = useState<string[]>([]);

  // 表示モード（リスト / 月カレンダー）
  const [viewMode, setViewMode] = useState<"agenda" | "month">("agenda");
  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date());
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  const [modal, setModal] = useState<Modal>("none");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState<string | null>(null); // 進捗テキスト
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 既存予定の編集（Googleのみ）
  const [editing, setEditing] = useState<ParsedEvent | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
      const all: CalendarEvent[] = [];
      const warns: string[] = [];
      if (token) {
        const items = await listEventsRange(token, settings.defaultCalendarId, start, end);
        all.push(...items.map((e) => ({ ...e, calendarSummary: e.calendarSummary ?? "Google" })));
        setConnected(true);
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
    [settings.defaultCalendarId, settings.icsSources],
  );

  const refreshAgenda = useCallback(async () => {
    const token = getAccessToken();
    const hasIcs = settings.icsSources.length > 0;
    if (!token && !hasIcs) return;
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
  }, [loadRange, settings.icsSources.length]);

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

  useEffect(() => {
    if (hasValidToken()) setConnected(true);
    if (hasValidToken() || settings.icsSources.length > 0) void refreshAgenda();
  }, [refreshAgenda, settings.icsSources.length]);

  // 月表示の時は表示月に応じて取得
  useEffect(() => {
    if (viewMode !== "month") return;
    if (hasValidToken() || settings.icsSources.length > 0) void refreshMonth();
  }, [viewMode, refreshMonth, settings.icsSources.length]);

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

  // Googleカレンダーへまとめて登録し、表示を更新
  const registerEvents = useCallback(
    async (events: ParsedEvent[]) => {
      const token = await ensureToken(settings.googleClientId);
      for (const ev of events) {
        await insertEvent(token, settings.defaultCalendarId, ev);
      }
      setConnected(true);
      await refreshAgenda();
      if (viewMode === "month") await refreshMonth();
    },
    [settings.googleClientId, settings.defaultCalendarId, refreshAgenda, refreshMonth, viewMode],
  );

  // 確認後 → Googleカレンダーへ登録
  const confirmEvents = async (events: ParsedEvent[]) => {
    setSaving(true);
    setError(null);
    try {
      await registerEvents(events);
      setParseResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // クイック登録: 確認画面をスキップして即登録
  const pickTemplate = async (t: EventTemplate, dateStr: string) => {
    const ev = buildEventFromTemplate(t, dateStr, settings.defaultDurationMin);
    setError(null);
    setParsing(`「${t.label}」を登録中…`);
    try {
      await registerEvents(withDefaultReminder([ev]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setParsing(null);
    }
  };

  // アジェンダのGoogle予定をタップ → 編集モーダルへ
  const onSelectEvent = (e: CalendarEvent) => {
    if (e.provider !== "google") return;
    setError(null);
    setEditingId(e.id);
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

  const saveEdit = async (updated: ParsedEvent) => {
    if (!editingId) return;
    setEditBusy(true);
    setError(null);
    try {
      const token = await ensureToken(settings.googleClientId);
      await updateEvent(token, settings.defaultCalendarId, editingId, updated);
      setEditing(null);
      setEditingId(null);
      await refreshAgenda();
      if (viewMode === "month") await refreshMonth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setEditBusy(false);
    }
  };

  const deleteEditing = async () => {
    if (!editingId) return;
    setEditBusy(true);
    setError(null);
    try {
      const token = await ensureToken(settings.googleClientId);
      await deleteEvent(token, settings.defaultCalendarId, editingId);
      setEditing(null);
      setEditingId(null);
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

        {viewMode === "agenda" && (
          <TemplateBar templates={settings.templates} onPick={pickTemplate} />
        )}

        {!connected && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="title">Googleカレンダーに接続</div>
            <div className="meta" style={{ marginBottom: 12 }}>
              予定の保存先です。接続すると直近の予定も表示されます。
            </div>
            <button className="btn primary" onClick={connect} style={{ width: "100%" }}>
              接続する
            </button>
          </div>
        )}

        {connected && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
            <button
              className="link-btn"
              onClick={() => {
                signOut();
                setConnected(false);
                setAgenda([]);
                setMonthEvents([]);
              }}
            >
              切断
            </button>
          </div>
        )}

        {(connected || settings.icsSources.length > 0) && (
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
              connected={connected || settings.icsSources.length > 0}
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

      <nav className="input-dock">
        <button
          className="dock-btn"
          onClick={() => setModal("voice")}
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

      {modal === "quick" && (
        <QuickAdd onCancel={() => setModal("none")} onSubmit={(t) => runParse(t, "manual")} />
      )}
      {modal === "voice" && (
        <VoiceCapture onCancel={() => setModal("none")} onResult={(t) => runParse(t, "voice")} />
      )}
      {modal === "photo" && (
        <PhotoCapture onCancel={() => setModal("none")} onText={(t) => runParse(t, "photo")} />
      )}
      {modal === "settings" && (
        <SettingsPanel
          settings={settings}
          token={getAccessToken()}
          onSave={onSaveSettings}
          onClose={() => setModal("none")}
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
          onCancel={() => {
            setEditing(null);
            setEditingId(null);
          }}
          onSave={saveEdit}
          onDelete={deleteEditing}
        />
      )}
    </>
  );
}
