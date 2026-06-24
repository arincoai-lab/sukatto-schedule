// Google Identity Services (GIS) のトークンクライアントでアクセストークンを取得。
// 公開クライアントIDのみ使用し、秘密鍵・バックエンドは不要。トークンはメモリ保持。

const GIS_SRC = "https://accounts.google.com/gsi/client";
// 必要最小限のスコープのみ要求する（OAuth審査の通過性とユーザー信頼のため）。
// - calendar.events: 予定の作成/更新/削除/取得（このアプリの主目的）
// - calendar.calendarlist.readonly: 書き込み先カレンダー選択用の一覧を読み取り専用で取得
// フルの auth/calendar（読み書き全権限）は過剰なため使わない。
const SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
].join(" ");

interface TokenResponse {
  access_token: string;
  expires_in: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
  callback: (resp: TokenResponse) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

let gisScriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google認証スクリプトの読込に失敗しました"));
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

let accessToken: string | null = null;
let tokenExpiry = 0; // epoch ms

export function hasValidToken(): boolean {
  return Boolean(accessToken) && Date.now() < tokenExpiry - 60_000;
}

export function getAccessToken(): string | null {
  return hasValidToken() ? accessToken : null;
}

export function signOut(): void {
  accessToken = null;
  tokenExpiry = 0;
}

// ユーザー操作（クリック）から呼ぶこと。ポップアップで認可を行う。
export async function requestToken(clientId: string): Promise<string> {
  if (!clientId) throw new Error("GoogleクライアントIDが未設定です");
  await loadGisScript();
  const oauth2 = window.google?.accounts.oauth2;
  if (!oauth2) throw new Error("Google認証を初期化できませんでした");

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error || "アクセストークンを取得できませんでした"));
          return;
        }
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + resp.expires_in * 1000;
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: hasValidToken() ? "" : "consent" });
  });
}

// 有効トークンがあれば返し、無ければ認可フローを起動
export async function ensureToken(clientId: string): Promise<string> {
  const existing = getAccessToken();
  if (existing) return existing;
  return requestToken(clientId);
}
