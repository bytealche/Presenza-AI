import api from "./api";

export const getAttendance = async () => {
  const res = await api.get("/attendance/view/teacher");
  return res.data;
};

export const getStudentAttendance = async () => {
  const res = await api.get("/attendance/view/student");
  return res.data;
};

export const getTeacherAttendance = async () => {
  const res = await api.get("/attendance/view/teacher");
  return res.data;
};

export const getAdminAttendance = async () => {
  const res = await api.get("/attendance/view/admin");
  return res.data;
};
