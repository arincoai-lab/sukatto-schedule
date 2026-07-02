// 3プロバイダ(Google/Outlook/iCloud)＋ICS購読の差異をここに集約する薄い抽象化層。
// App.tsx は「どのプロバイダに書くか/読むか」の分岐を持たず、この層の関数を呼ぶだけにする。
// 認可の取り方（OAuthトークン/Basic資格情報）や宛先IDの形（calendarId/イベントhref）の
// 違いは各分岐の内側に閉じ込める。
import type { ParsedEvent, CalendarEvent } from "../types";
import type { AppSettings } from "../store/settings";
import { ensureToken, getAccessToken } from "./google-auth";
import {
  insertEvent,
  listEventsRange,
  updateEvent,
  deleteEvent,
} from "./google-events";
import { ensureOutlookToken, getOutlookAccessToken } from "./outlook-auth";
import {
  insertOutlookEvent,
  listOutlookEventsRange,
  updateOutlookEvent,
  deleteOutlookEvent,
} from "./outlook-events";
import { loadIcloudCred } from "./icloud-cred";
import {
  insertIcloudEvent,
  listIcloudEventsRange,
  updateIcloudEvent,
  deleteIcloudEvent,
} from "./caldav-events";
import { fetchIcsSource } from "./ics";

export type ProviderKey = "google" | "outlook" | "icloud";

export interface ActiveFlags {
  google: boolean;
  outlook: boolean;
  icloud: boolean;
}

/** 登録先1件（表示ラベルと登録関数のペア）。 */
export interface WriteSink {
  label: string;
  insert: (ev: ParsedEvent) => Promise<unknown>;
}

export interface PreparedWrite {
  sinks: WriteSink[];
  active: ActiveFlags;
}

function icloudCalName(settings: AppSettings, url: string): string {
  return settings.icloudCalendars.find((c) => c.url === url)?.displayName ?? "iCloud";
}

/**
 * 設定に基づき全登録先のsinkを認可込みで準備する。
 * Googleは主保存先のため常に必須（未認可ならここでポップアップが出る）。
 * Outlook/iCloudは書き込み先が選択されている場合のみ。
 */
export async function prepareWriteSinks(settings: AppSettings): Promise<PreparedWrite> {
  const gTargets =
    settings.writeCalendarIds.length > 0
      ? settings.writeCalendarIds
      : [settings.defaultCalendarId || "primary"];
  const oTargets = settings.outlookWriteCalendarIds;
  const wantOutlook = oTargets.length > 0 && Boolean(settings.outlookClientId);
  const iTargets = settings.icloudWriteCalendarUrls;
  const icloudCred = iTargets.length > 0 ? loadIcloudCred() : null;

  const gToken = await ensureToken(settings.googleClientId);
  const oToken = wantOutlook ? await ensureOutlookToken(settings.outlookClientId) : null;

  const sinks: WriteSink[] = [
    ...gTargets.map((cid) => ({
      label: `Google:${cid}`,
      insert: (ev: ParsedEvent) => insertEvent(gToken, cid, ev),
    })),
    ...(oToken
      ? oTargets.map((cid) => ({
          label: `Outlook:${cid.slice(0, 8)}`,
          insert: (ev: ParsedEvent) => insertOutlookEvent(oToken, cid, ev),
        }))
      : []),
    ...(icloudCred
      ? iTargets.map((url) => ({
          label: `iCloud:${icloudCalName(settings, url)}`,
          insert: (ev: ParsedEvent) => insertIcloudEvent(icloudCred, url, ev),
        }))
      : []),
  ];
  return {
    sinks,
    active: { google: true, outlook: Boolean(oToken), icloud: Boolean(icloudCred) },
  };
}

/** 既存予定を由来プロバイダへルーティングして更新（iCloudのidは予定の絶対URL=href）。 */
export async function updateProviderEvent(
  settings: AppSettings,
  provider: ProviderKey,
  calendarId: string,
  id: string,
  ev: ParsedEvent,
): Promise<void> {
  if (provider === "google") {
    const token = await ensureToken(settings.googleClientId);
    await updateEvent(token, calendarId, id, ev);
  } else if (provider === "outlook") {
    const token = await ensureOutlookToken(settings.outlookClientId);
    await updateOutlookEvent(token, calendarId, id, ev);
  } else {
    const cred = loadIcloudCred();
    if (!cred) throw new Error("iCloud未接続です");
    await updateIcloudEvent(cred, id, ev);
  }
}

/** 既存予定を由来プロバイダへルーティングして削除（iCloudのidは予定の絶対URL=href）。 */
export async function deleteProviderEvent(
  settings: AppSettings,
  provider: ProviderKey,
  calendarId: string,
  id: string,
): Promise<void> {
  if (provider === "google") {
    const token = await ensureToken(settings.googleClientId);
    await deleteEvent(token, calendarId, id);
  } else if (provider === "outlook") {
    const token = await ensureOutlookToken(settings.outlookClientId);
    await deleteOutlookEvent(token, calendarId, id);
  } else {
    const cred = loadIcloudCred();
    if (!cred) throw new Error("iCloud未接続です");
    await deleteIcloudEvent(cred, id);
  }
}

export interface RangeLoadResult {
  events: CalendarEvent[];
  warnings: string[];
  active: ActiveFlags;
}

/**
 * 接続済みの全ソース(Google/Outlook/iCloud/ICS)から指定期間の予定をまとめて取得する。
 * 認可済みトークン/資格情報が無いソースは黙ってスキップ（activeフラグで通知）。
 * ソース単位の失敗はwarningsに集約し、他ソースの取得は継続する。
 */
export async function loadEventsRange(
  settings: AppSettings,
  start: Date,
  end: Date,
): Promise<RangeLoadResult> {
  const token = getAccessToken();
  const oToken = getOutlookAccessToken();
  const all: CalendarEvent[] = [];
  const warns: string[] = [];
  const active: ActiveFlags = { google: false, outlook: false, icloud: false };

  if (token) {
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
    active.google = true;
  }

  if (oToken && settings.outlookWriteCalendarIds.length > 0) {
    const oResults = await Promise.allSettled(
      settings.outlookWriteCalendarIds.map((cid) =>
        listOutlookEventsRange(oToken, cid, start, end),
      ),
    );
    oResults.forEach((r, i) => {
      if (r.status === "fulfilled") {
        all.push(
          ...r.value.map((e) => ({ ...e, calendarSummary: e.calendarSummary ?? "Outlook" })),
        );
      } else {
        warns.push(`Outlookカレンダー「${settings.outlookWriteCalendarIds[i]}」の取得に失敗`);
      }
    });
    active.outlook = true;
  }

  const icloudCred = loadIcloudCred();
  if (icloudCred && settings.icloudWriteCalendarUrls.length > 0) {
    const iResults = await Promise.allSettled(
      settings.icloudWriteCalendarUrls.map((url) =>
        listIcloudEventsRange(icloudCred, url, icloudCalName(settings, url), start, end),
      ),
    );
    iResults.forEach((r, i) => {
      if (r.status === "fulfilled") all.push(...r.value);
      else
        warns.push(
          `iCloudカレンダー「${icloudCalName(settings, settings.icloudWriteCalendarUrls[i])}」の取得に失敗`,
        );
    });
    active.icloud = true;
  }

  const icsResults = await Promise.allSettled(
    settings.icsSources.map((s) => fetchIcsSource(s, start, end)),
  );
  icsResults.forEach((r, i) => {
    if (r.status === "fulfilled") all.push(...r.value);
    else warns.push(`「${settings.icsSources[i].label}」の取得に失敗しました`);
  });

  all.sort((a, b) => a.start.localeCompare(b.start));
  return { events: all, warnings: warns, active };
}
