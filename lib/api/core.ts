/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { deleteCookie } from "cookies-next";
import { store } from "@/lib/redux/store";
import { logout } from "@/lib/redux/slices/authSlice";

export interface ApiError {
  code?: number;
  message: string;
  status: boolean;
  data?: unknown;
}

export interface RequestParams {
  [key: string]: string | number | boolean | undefined | null | string[];
}

class ApiService {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: unknown) => void;
  }> = [];

  constructor(baseURL: string, timeout = 600000) {
    this.client = axios.create({
      baseURL,
      timeout,
      headers: { "Content-Type": "application/json" },
    });
    this.setupInterceptors();
  }

  private processQueue(error: unknown, token: string | null = null) {
    this.failedQueue.forEach((prom) => {
      if (error) prom.reject(error);
      else prom.resolve(token!);
    });
    this.failedQueue = [];
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        const token = store.getState().auth.token;
        if (token) config.headers.Authorization = `Bearer ${token}`;
        if (config.data instanceof FormData) delete config.headers["Content-Type"];
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            })
              .then((token) => {
                originalRequest.headers["Authorization"] = "Bearer " + token;
                return this.client(originalRequest);
              })
              .catch((err) => Promise.reject(err));
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const refreshToken = store.getState().auth.refreshToken;
            if (!refreshToken) throw new Error("No refresh token");

            const response = await axios.post(
              `${process.env.NEXT_PUBLIC_API_URL}api/v1/auth/refresh-token`,
              { refreshToken },
              { headers: { "Content-Type": "application/json" } }
            );

            if (response.data?.data?.accessToken) {
              const { accessToken, refreshToken: newRefreshToken } = response.data.data;

              const { setTokenWithRefresh } = await import("@/lib/redux/slices/authSlice");
              const { setCookie } = await import("cookies-next");
              const { getAuthCookieConfig } = await import("@/utils/cookieConfig");

              store.dispatch(setTokenWithRefresh({ accessToken, refreshToken: newRefreshToken }));
              setCookie("authToken", accessToken, getAuthCookieConfig());

              this.processQueue(null, accessToken);
              this.isRefreshing = false;

              originalRequest.headers["Authorization"] = "Bearer " + accessToken;
              return this.client(originalRequest);
            }

            throw new Error("Invalid refresh response");
          } catch (refreshError) {
            this.isRefreshing = false;
            this.processQueue(refreshError, null);

            deleteCookie("authToken", { path: "/" });
            store.dispatch(logout());

            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("logout"));
            }

            return Promise.reject({
              code: 401,
              message: "Session expired. Please login again.",
              status: false,
            } as ApiError);
          }
        }

        const apiError: ApiError = {
          code: error.response?.status,
          message: error.response?.data?.message || error.message || "Có lỗi xảy ra",
          status: false,
          data: error.response?.data,
        };

        return Promise.reject(apiError);
      }
    );
  }

  setAuthToken() {
    // Token read from Redux store in request interceptor
  }

  async request<T>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.request<T>(config);
  }

  async get<T>(url: string, params?: Record<string, any>): Promise<AxiosResponse<T>> {
    return this.request<T>({ method: "GET", url, params });
  }

  async post<T, D = unknown>(url: string, data?: D): Promise<AxiosResponse<T>> {
    return this.request<T>({ method: "POST", url, data });
  }

  async put<T, D = unknown>(url: string, data?: D): Promise<AxiosResponse<T>> {
    return this.request<T>({ method: "PUT", url, data });
  }

  async patch<T, D = unknown>(url: string, data?: D): Promise<AxiosResponse<T>> {
    return this.request<T>({ method: "PATCH", url, data });
  }

  async delete<T>(url: string): Promise<AxiosResponse<T>> {
    return this.request<T>({ method: "DELETE", url });
  }
}

const apiService = new ApiService(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/");

export default apiService;
