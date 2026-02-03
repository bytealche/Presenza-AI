"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/utils/token";

export default function DashboardLayout({ children }) {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.push("/login");
  }, []);

  return <>{children}</>;
}
