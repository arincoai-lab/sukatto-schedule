import { PublicClientApplication, type AccountInfo } from "@azure/msal-browser";

// Microsoft (Outlook/Microsoft 365) 認証。MSAL PKCEのSPAフロー。
// 必要なスコープは Calendars.ReadWrite（読み書き）。
// アクセストークンはメモリ保持し、必要時に静的取得(silent)→失敗ならポップアップ再認証。

const SCOPES = ["Calendars.ReadWrite", "offline_access", "openid", "profile"];

let pca: PublicClientApplication | null = null;
let initialized = false;
let currentAccount: AccountInfo | null = null;
let accessToken: string | null = null;
let tokenExpiry = 0;

async function ensureClient(clientId: string): Promise<PublicClientApplication> {
  if (pca && initialized) return pca;
  pca = new PublicClientApplication({
    auth: {
      clientId,
      authority: "https://login.microsoftonline.com/common", // 個人/職場どちらのMSアカウントも可
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: "localStorage" },
  });
  await pca.initialize();
  initialized = true;
  // 既存アカウントを復元
  const accounts = pca.getAllAccounts();
  if (accounts.length > 0) currentAccount = accounts[0];
  return pca;
}

export function hasOutlookValidToken(): boolean {
  return Boolean(accessToken) && Date.now() < tokenExpiry - 60_000;
}

export function getOutlookAccessToken(): string | null {
  return hasOutlookValidToken() ? accessToken : null;
}

export function outlookSignOut(): void {
  accessToken = null;
  tokenExpiry = 0;
  if (pca && currentAccount) {
    // ローカルセッションのみ消去（リダイレクトせずキャッシュクリア）
    void pca.clearCache({ account: currentAccount });
  }
  currentAccount = null;
}

// ユーザー操作からのみ呼ぶ（ポップアップが開く）。
export async function requestOutlookToken(clientId: string): Promise<string> {
  if (!clientId) throw new Error("Microsoft クライアントIDが未設定です");
  const client = await ensureClient(clientId);

  // まず静的取得を試みる
  if (currentAccount) {
    try {
      const r = await client.acquireTokenSilent({
        scopes: SCOPES,
        account: currentAccount,
      });
      accessToken = r.accessToken;
      tokenExpiry = r.expiresOn?.getTime() ?? Date.now() + 60 * 60_000;
      return r.accessToken;
    } catch {
      // 静的失敗 → ポップアップへフォールバック
    }
  }

  const r = await client.acquireTokenPopup({ scopes: SCOPES });
  currentAccount = r.account ?? currentAccount;
  accessToken = r.accessToken;
  tokenExpiry = r.expiresOn?.getTime() ?? Date.now() + 60 * 60_000;
  return r.accessToken;
}

// 既存有効トークンがあれば返し、無ければ静的→ポップアップで取得
export async function ensureOutlookToken(clientId: string): Promise<string> {
  const existing = getOutlookAccessToken();
  if (existing) return existing;
  return requestOutlookToken(clientId);
}
