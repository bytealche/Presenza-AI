import api from "./api";

export interface LoginResponse {
  access_token: string;
}

export const login = async (data: { email: string; password: string }): Promise<LoginResponse> => {
  // Determine if we need face login or standard login
  // For now, let's keep it simple. If data has 'file', it's face login
  // BUT wait, login endpoint expects JSON. login-with-face expects Form.
  // The component calling this should decide.
  // Let's make this function just for standard login.
  const res = await api.post<LoginResponse>("/auth/login", data);
  return res.data;
};

export const loginWithFace = async (formData: FormData): Promise<LoginResponse> => {
  const res = await api.post<LoginResponse>("/auth/login-with-face", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return res.data;
}

export const registerWithFace = async (formData: FormData): Promise<any> => {
  const res = await api.post("/users/register-with-face", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data;
};

// --- New Endpoints ---

export const sendOTP = async (email: string) => {
  const res = await api.post("/auth/send-otp", { email });
  return res.data;
}

export const registerOrganization = async (data: any) => {
  const res = await api.post("/auth/register-organization", data);
  return res.data;
}

export const registerUser = async (data: any) => {
  const res = await api.post("/auth/register-user", data);
  return res.data;
}

export const getOrganizations = async () => {
  const res = await api.get("/organizations");
  return res.data;
}

export const getUsers = async (role_id?: number) => {
  const res = await api.get("/users", {
    params: { role_id }
  });
  return res.data;
}

export const updateUserStatus = async (user_id: number, status: string) => {
  const res = await api.put(`/users/${user_id}/status`, { status });
  return res.data;
}
