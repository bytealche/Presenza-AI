"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { decodeToken } from "@/utils/token";

interface UserPayload {
  user_id: number;
  role_id: number;
}

interface AuthContextType {
  user: UserPayload | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserPayload | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) setUser(decodeToken(token));
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
