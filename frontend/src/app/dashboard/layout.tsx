"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/utils/token";
import React from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.push("/login");
  }, []);

  return <>{children}</>;
}
