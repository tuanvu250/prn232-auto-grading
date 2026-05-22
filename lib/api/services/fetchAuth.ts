import apiService from "../core";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  isSuccess: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresAt?: string;
    tokenType?: string;
  };
  metadata?: unknown;
}

export const fetchAuth = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiService.post<LoginResponse>("api/v1/auth/login", data);
    return response.data;
  },

  register: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiService.post<LoginResponse>("api/v1/auth/register", data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiService.post("api/v1/auth/logout");
  },
};
