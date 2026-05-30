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

export const enrollInSubject = async (subjectName: string): Promise<any> => {
  const res = await api.post("/enrollments/subject", {
    subject_name: subjectName
  });
  return res.data;
};

export const getMySubjectEnrollments = async (): Promise<string[]> => {
  const res = await api.get<string[]>("/enrollments/subject/my");
  return res.data;
};
