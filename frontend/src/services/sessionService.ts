import api from "./api";

export interface Session {
  session_id: number;
  session_name: string;
  start_time: string;
  end_time: string;
  location?: string;
  camera_id?: number;
  org_id?: number;
  created_by?: number;
  class_type?: string;
  is_approved?: boolean;
}

export interface SessionCreate {
  session_name: string;
  start_time: string;
  end_time: string;
  location?: string;
  camera_id?: number;
  class_type?: string;
}

export const getSessions = async (teacher_id?: number): Promise<Session[]> => {
  const res = await api.get<Session[]>("/sessions", {
    params: { teacher_id }
  });
  return res.data;
};

export interface AttendanceRecord {
  user_id: number;
  full_name: string;
  email: string;
  status: string;
  timestamp: string;
}

export const getSessionAttendance = async (session_id: number): Promise<AttendanceRecord[]> => {
  const res = await api.get<AttendanceRecord[]>(`/attendance/session/${session_id}`);
  return res.data;
}

export const createSession = async (data: SessionCreate): Promise<Session> => {
  const res = await api.post<Session>("/sessions", data);
  return res.data;
}

export const runAI = async (sessionId: string) => {
  const res = await api.post(`/ai/run/${sessionId}`);
  return res.data;
};

export const approveSession = async (sessionId: number) => {
  const res = await api.post(`/sessions/${sessionId}/approve`);
  return res.data;
};

export const rejectSession = async (sessionId: number) => {
  const res = await api.post(`/sessions/${sessionId}/reject`);
  return res.data;
};

export const notifyClass = async (
  sessionId: number,
  subject: string,
  message: string
): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>(`/sessions/${sessionId}/notify`, {
    subject,
    message
  });
  return res.data;
};


