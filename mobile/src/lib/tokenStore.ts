import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'store_access_token';
const REFRESH_TOKEN_KEY = 'store_refresh_token';
const USER_KEY = 'store_user';

const isWeb = Platform.OS === 'web';

// expo-secure-store v14 is synchronous and is not available in the browser.
// On web we fall back to window.localStorage so the app boots in Expo Web too.
function webGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function webSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // ignore quota / disabled storage
  }
}

function webDelete(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // ignore
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (isWeb) {
    return webGet(ACCESS_TOKEN_KEY);
  }
  return SecureStore.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  if (isWeb) {
    return webGet(REFRESH_TOKEN_KEY);
  }
  return SecureStore.getItem(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  if (isWeb) {
    webSet(ACCESS_TOKEN_KEY, accessToken);
    webSet(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
  await SecureStore.setItem(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function setStoredUser(userJson: string): Promise<void> {
  if (isWeb) {
    webSet(USER_KEY, userJson);
    return;
  }
  await SecureStore.setItem(USER_KEY, userJson);
}

export async function getStoredUser(): Promise<string | null> {
  if (isWeb) {
    return webGet(USER_KEY);
  }
  return SecureStore.getItem(USER_KEY);
}

export async function clearTokens(): Promise<void> {
  if (isWeb) {
    webDelete(ACCESS_TOKEN_KEY);
    webDelete(REFRESH_TOKEN_KEY);
    webDelete(USER_KEY);
    return;
  }
  // expo-secure-store v14 only exposes the *Async variants; the sync
  // `deleteItem` does not exist on this version, so we must await.
  // Each delete is wrapped individually because a missing key can reject
  // on some Android emulator builds — we still want the others to clear.
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
  await SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined);
}