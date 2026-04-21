"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    if (!user) return null;

    const role = user.role_id === 1 ? 'admin'
        : user.role_id === 2 ? 'teacher'
            : 'student';

    const commonLinks = [
        { name: "Attendance", href: "/dashboard/attendance" },
    ];

    const adminLinks = [
        { name: "Overview", href: "/dashboard/admin" },
        { name: "AI Logs", href: "/dashboard/ai-logs" },
        { name: "Fraud Detection", href: "/dashboard/fraud" },
    ];

    const teacherLinks = [
        { name: "My Classes", href: "/dashboard/teacher" },
        { name: "Engagement", href: "/dashboard/engagement" },
    ];

    const studentLinks = [
        { name: "My Attendance", href: "/dashboard/student" },
    ];

    const links = [
        ...(role === 'admin' ? adminLinks : []),
        ...(role === 'teacher' ? teacherLinks : []),
        ...(role === 'student' ? studentLinks : []),
        ...((role === 'admin' || role === 'teacher') ? [{ name: "Camera Feed", href: "/dashboard/camera" }] : []),
        ...commonLinks
    ];

    return (
        <div className="flex flex-col w-64 h-screen bg-[var(--sidebar-bg)] border-r-0 border-[var(--glass-border)] text-[var(--sidebar-text)] relative z-20 transition-colors duration-300">
            <div className="flex items-center justify-center h-20 border-b border-[var(--glass-border)] bg-[var(--glass-highlight)] backdrop-blur-sm">
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-dark drop-shadow-sm">
                    Presenza AI
                </h1>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent py-4">
                <nav className="px-3 space-y-1">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`block px-4 py-3 rounded-xl transition-all duration-300 font-medium ${pathname === link.href
                                ? "bg-accent/20 text-accent border border-accent/20 shadow-[0_0_20px_-5px_var(--color-accent)] backdrop-blur-lg"
                                : "text-[var(--muted-bright)] hover:bg-[var(--glass-highlight)] hover:text-[var(--sidebar-text)] hover:pl-5"
                                }`}
                        >
                            {link.name}
                        </Link>
                    ))}
                </nav>
            </div>
            <div className="p-4 border-t border-[var(--glass-border)] bg-[var(--glass-highlight)] backdrop-blur-md">
                <div className="mb-4 text-sm text-[var(--muted-bright)]">
                    Logged in as: <span className="font-semibold text-[var(--sidebar-text)] block truncate">{user.full_name || role}</span>
                </div>
                <button
                    onClick={logout}
                    className="w-full px-4 py-2 text-sm font-medium text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 hover:border-red-500/40 transition-all focus:outline-none shadow-lg shadow-red-500/5"
                >
                    Logout
                </button>
            </div>
        </div>
    );
}
