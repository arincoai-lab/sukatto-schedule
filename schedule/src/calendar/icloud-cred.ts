// iCloud(CalDAV) の資格情報を端末ローカルに保存する。
// Apple は CalDAV に OAuth を提供しないため、Apple ID と「アプリ用パスワード」
// (appleid.apple.com で発行) を用いる。アプリ用パスワードは通常のApple IDパスワード
// とは別物で、カレンダー(CalDAV)へのアクセスに限定される。
//
// 注意: これはユーザー本人の資格情報であり、本人の端末の localStorage にのみ保存する。
// 設定本体(settings)とはキーを分け、誤って広い設定オブジェクトに混ざらないようにする。

export interface IcloudCredential {
  appleId: string; // Apple ID（メールアドレス）
  appPassword: string; // アプリ用パスワード（xxxx-xxxx-xxxx-xxxx 形式）
}

const CRED_KEY = "sukatto.icloud.cred.v1";

export function loadIcloudCred(): IcloudCredential | null {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<IcloudCredential>;
    if (!parsed.appleId || !parsed.appPassword) return null;
    return { appleId: parsed.appleId, appPassword: parsed.appPassword };
  } catch {
    return null;
  }
}

export function saveIcloudCred(cred: IcloudCredential): void {
  localStorage.setItem(CRED_KEY, JSON.stringify(cred));
}

export function clearIcloudCred(): void {
  localStorage.removeItem(CRED_KEY);
}

export function hasIcloudCred(): boolean {
  return loadIcloudCred() !== null;
}
