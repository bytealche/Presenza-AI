import api from "./api";

export interface LoginResponse {
  access_token: string;
}

export const login = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  const res = await api.post<LoginResponse>("/auth/login", {
    email,
    password,
  });
  return res.data;
};
