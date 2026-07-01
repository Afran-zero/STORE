import axios, { type AxiosError } from 'axios';

import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/tokenStore';
import { ApiException, type ApiError, type ApiSuccess } from '@/types/api';

const baseURL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

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

    throw new ApiException('Network error', 'NETWORK_ERROR');
  },
);
