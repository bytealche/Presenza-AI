import api from "./api";

export const getSessions = async () => {
  const res = await api.get("/sessions");
  return res.data;
};

export const runAI = async (sessionId: string) => {
  const res = await api.post(`/ai/run/${sessionId}`);
  return res.data;
};
