"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardRedirect() {
  const auth = useAuth();
  const user = auth?.user;
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    if (user.role_id === 1) router.push("/dashboard/admin");
    else if (user.role_id === 2) router.push("/dashboard/teacher");
    else if (user.role_id === 3) router.push("/dashboard/student");
  }, [user]);

  return <p>Redirecting...</p>;
}
