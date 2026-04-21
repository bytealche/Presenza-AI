"use client";
import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getToken } from "@/utils/token";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const { user } = useAuth(); // If this throws due to missing provider locally, we handle it

  useEffect(() => {
    // Check if token exists in localStorage (direct) or if user is set
    // Ideally, if user becomes null, we redirect.
    if (!getToken()) router.push("/login");
  }, [user]); // Add user dependency

  // Get pathname for transition key
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-transparent text-foreground overflow-hidden selection:bg-accent selection:text-white relative w-full">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Wrapper */}
      <div className={`fixed inset-y-0 left-0 z-50 transform ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <Sidebar className="w-64" />
      </div>

      <div className="flex-1 flex flex-col relative z-10 w-full min-w-0 overflow-hidden">
        {/* Glassmorphic Header */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-4 bg-secondary/30 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30">
          <div className="flex items-center gap-3 w-full">
            <button 
                className="md:hidden p-2 -ml-2 text-muted hover:text-white transition-colors"
                onClick={() => setIsMobileMenuOpen(true)}
            >
                <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg sm:text-xl font-semibold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 truncate">
               Analysis Dashboard
            </h2>
          </div>
          {/* Add User Profile or other controls here later */}
        </header>

        {/* content area */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-accent/20 scrollbar-track-transparent">
          {/* Page Transition */}
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
