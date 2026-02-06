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

export const registerWithFace = async (formData: FormData): Promise<any> => {
  const res = await api.post("/users/register-with-face", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};
