"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/utils/token";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const { user } = useAuth(); // If this throws due to missing provider locally, we handle it

  useEffect(() => {
    // Check if token exists in localStorage (direct) or if user is set
    // Ideally, if user becomes null, we redirect.
    if (!getToken()) router.push("/login");
  }, [user]); // Add user dependency

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-accent selection:text-white">
      {/* Sidebar Wrapper with Gradient Border/Glow if desired, simple for now */}
      <Sidebar />

      <div className="flex-1 flex flex-col relative z-10">
        {/* Glassmorphic Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-secondary/30 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
          <h2 className="text-xl font-semibold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Analysis Dashboard
          </h2>
          {/* Add User Profile or other controls here later */}
        </header>

        {/* content area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent">
          {children}
        </main>
      </div>
    </div>
  );
}
