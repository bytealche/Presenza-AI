import api from "./api";

export interface Session {
  session_id: number;
  session_name: string;
  start_time: string;
  end_time: string;
  location: string;
  camera_id?: number;
}

export interface SessionCreate {
  session_name: string;
  start_time: string;
  end_time: string;
  location?: string;
  camera_id?: number;
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
