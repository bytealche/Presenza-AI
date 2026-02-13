"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      if (user.role_id === 1) {
        router.push("/dashboard/admin");
      } else if (user.role_id === 2) {
        router.push("/dashboard/teacher");
      } else if (user.role_id === 3) {
        router.push("/dashboard/student");
      } else {
        // Fallback or unknown role
        router.push("/login");
      }
    }
  }, [user, router]);

  return (
    <div className="flex items-center justify-center h-full text-muted">
      Loading dashboard...
    </div>
  );
}
