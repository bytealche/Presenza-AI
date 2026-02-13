"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { decodeToken } from "@/utils/token";

interface UserPayload {
  user_id: number;
  role_id: number;
  org_id: number;
  full_name: string;
  email: string;
}

interface AuthContextType {
  user: UserPayload | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserPayload | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) setUser(decodeToken(token));
  }, []);

  const login = (token: string) => {
    localStorage.setItem("token", token);
    setUser(decodeToken(token));
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext)!;
