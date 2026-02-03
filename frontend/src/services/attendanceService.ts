import api from "./api";

export const getAttendance = async () => {
  const res = await api.get("/attendance/view/teacher");
  return res.data;
};
