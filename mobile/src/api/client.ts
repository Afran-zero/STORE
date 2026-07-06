import axios, { type AxiosError } from 'axios';
import { Platform } from 'react-native';

import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/tokenStore';
import { ApiException, type ApiError, type ApiSuccess } from '@/types/api';

// Resolve the backend base URL with sensible per-platform defaults so the
// app "just works" whether you open it in Expo Web, an emulator, or a
// physical device on the same LAN — without hardcoding an IP.
//
// Override at runtime with EXPO_PUBLIC_API_BASE_URL (e.g. http://192.168.1.20:8000).
function resolveBaseURL(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (Platform.OS === 'android') {
    // Android emulator maps host machine localhost to 10.0.2.2
    return 'http://10.0.2.2:8000';
  }
  // iOS simulator, web, and any other platform can reach the host via localhost
  return 'http://localhost:8000';
}

const baseURL = resolveBaseURL();

// Surface the resolved URL once at module load. This makes misconfiguration
// obvious in the Metro console instead of mysterious "Network error" later.
if (typeof console !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log(`[api] baseURL = ${baseURL} (platform = ${Platform.OS})`);
}

export const apiClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function refreshSession(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<ApiSuccess<{ accessToken: string; refreshToken: string }>>(
      `${baseURL}/api/v1/auth/refresh-token`,
      { refreshToken },
    );
    const { accessToken, refreshToken: nextRefreshToken } = response.data.data;
    await setTokens(accessToken, nextRefreshToken);
    return accessToken;
  } catch {
    await clearTokens();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiSuccess<unknown> | unknown;
    if (typeof payload === 'object' && payload !== null && 'success' in payload) {
      if ((payload as ApiSuccess<unknown>).success) {
        return (payload as ApiSuccess<unknown>).data;
      }
      const errorPayload = payload as ApiError;
      throw new ApiException(errorPayload.error.message, errorPayload.error.code, errorPayload.error.details);
    }
    return response.data;
  },
  async (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      const renewedToken = await refreshSession();
      if (renewedToken && error.config) {
        error.config.headers = error.config.headers ?? {};
        error.config.headers.Authorization = `Bearer ${renewedToken}`;
        return apiClient.request(error.config);
      }
    }

    if (error.response?.data?.success === false) {
      throw new ApiException(error.response.data.error.message, error.response.data.error.code, error.response.data.error.details);
    }

    // No HTTP response = the request never reached the backend.
    // Give the user a hint that points at the most common causes instead of
    // a bare "Network error".
    const detail =
      error.code === 'ECONNABORTED'
        ? 'The server took too long to respond.'
        : error.message || 'Could not reach the server.';
    throw new ApiException(
      `Network error: ${detail} (tried ${baseURL}). Is the backend running and reachable from this device?`,
      'NETWORK_ERROR',
    );
  },
);
