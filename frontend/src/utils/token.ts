export const getToken = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
};

export const decodeToken = (token) => {
  if (!token) return null;
  const payload = token.split(".")[1];
  return JSON.parse(atob(payload));
};
