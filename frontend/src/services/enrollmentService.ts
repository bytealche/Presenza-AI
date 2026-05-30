import api from "./api";

export interface Enrollment {
  enrollment_id: number;
  session_id: number;
  user_id: number;
}

export const getMyEnrollments = async (): Promise<Enrollment[]> => {
  const res = await api.get<Enrollment[]>("/enrollments/my");
  return res.data;
};

export const enrollInSession = async (sessionId: number, userId: number): Promise<Enrollment> => {
  const res = await api.post<Enrollment>("/enrollments/", {
    session_id: sessionId,
    user_id: userId
  });
  return res.data;
};
