"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSessions, Session } from "@/services/sessionService";
import { getMyEnrollments, enrollInSession, Enrollment } from "@/services/enrollmentService";
import { getUsers } from "@/services/authService";
import { 
    Loader2, BookOpen, UserCheck, Calendar, Clock, MapPin, 
    Sparkles, ShieldCheck, CheckCircle2, AlertCircle 
} from "lucide-react";

export default function StudentEnrollmentPage() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [teachers, setTeachers] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [enrollingId, setEnrollingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            loadEnrollmentData();
        }
    }, [user]);

    const loadEnrollmentData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch sessions, active enrollments, and teacher profiles in parallel
            const [sessionsData, enrollmentsData, teachersData] = await Promise.all([
                getSessions(),
                getMyEnrollments(),
                getUsers(2) // Role ID 2 = Teacher
            ]);

            // Map teachers by user_id for instant O(1) lookups
            const teacherMap: Record<number, string> = {};
            teachersData.forEach((t: any) => {
                teacherMap[t.user_id] = t.full_name;
            });

            setSessions(sessionsData);
            setEnrollments(enrollmentsData);
            setTeachers(teacherMap);
        } catch (err) {
            console.error("Failed to load enrollment details:", err);
            setError("Failed to sync available subject courses. Please refresh.");
        } finally {
            setLoading(false);
        }
    };

    const handleEnroll = async (sessionId: number) => {
        if (!user) return;
        setEnrollingId(sessionId);
        setError(null);
        setSuccessMessage(null);
        try {
            const newEnrollment = await enrollInSession(sessionId, user.user_id);
            setEnrollments(prev => [...prev, newEnrollment]);
            
            const sessionName = sessions.find(s => s.session_id === sessionId)?.session_name || "subject";
            setSuccessMessage(`Successfully enrolled in ${sessionName}!`);
            
            // Auto fade success message
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            console.error("Enrollment failed:", err);
            setError(err?.response?.data?.detail || "Failed to complete enrollment. Please try again.");
        } finally {
            setEnrollingId(null);
        }
    };

    // Helper to check if student is enrolled in a specific class
    const isEnrolled = (sessionId: number) => {
        return enrollments.some(e => e.session_id === sessionId);
    };

    if (loading) {
        return (
            <div className="p-16 text-center text-muted flex flex-col items-center gap-3 justify-center max-w-md mx-auto mt-20 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <span className="text-sm font-semibold tracking-wide">Syncing available academic curriculum...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 animate-in fade-in duration-300">
            {/* Header */}
            <div className="border-b border-[var(--glass-border)] pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent via-foreground to-purple-400 drop-shadow-md tracking-tight">
                        Course & Subject Enrollment
                    </h2>
                    <p className="text-muted text-sm mt-1">
                        Select and enroll under your registered subjects to sync attendance profiles with live biometric check-ins.
                    </p>
                </div>
                <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-4 py-2.5 rounded-xl text-xs font-semibold text-accent flex items-center gap-2 w-fit">
                    <ShieldCheck className="w-4.5 h-4.5" />
                    Student Portal Registered
                </div>
            </div>

            {/* Error and Success Alarms */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold animate-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl flex items-center gap-3 text-sm font-semibold animate-in slide-in-from-top-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0 animate-bounce" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Course Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sessions.map((cls) => {
                    const enrolled = isEnrolled(cls.session_id);
                    const teacherName = teachers[cls.created_by || 0] || "Faculty Professor";
                    const isUpcoming = new Date(cls.start_time) > new Date();

                    return (
                        <div 
                            key={cls.session_id} 
                            className={`glass-card p-6 border relative overflow-hidden transition-all duration-300 flex flex-col justify-between group ${
                                enrolled 
                                    ? "border-emerald-500/30 bg-emerald-950/5 shadow-[0_0_20px_-10px_rgba(16,185,129,0.2)]" 
                                    : "hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5"
                            }`}
                        >
                            {/* Accent Background Glow for enrolled */}
                            {enrolled && (
                                <div className="absolute top-0 right-0 p-3 opacity-15">
                                    <CheckCircle2 className="w-20 h-20 text-emerald-400" />
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <span className={`px-2.5 py-0.5 rounded-lg border uppercase tracking-wider text-[9px] font-black ${
                                        cls.class_type === "offline"
                                            ? "bg-purple-500/15 border-purple-500/35 text-purple-400"
                                            : "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                                    }`}>
                                        {cls.class_type === "offline" ? "Offline" : "Online / Hybrid"}
                                    </span>
                                    {isUpcoming && (
                                        <span className="bg-blue-500/10 border border-blue-500/25 text-blue-400 px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider">
                                            Upcoming
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-xl font-bold text-foreground tracking-tight group-hover:text-accent transition-colors line-clamp-1 mb-1">
                                    {cls.session_name}
                                </h3>
                                
                                <p className="text-xs text-muted font-bold flex items-center gap-1.5 mb-5">
                                    <BookOpen className="w-3.5 h-3.5 text-accent" />
                                    Taught by: <span className="text-foreground">{teacherName}</span>
                                </p>

                                <div className="space-y-2.5 text-xs text-muted border-t border-[var(--glass-border)] pt-4 mb-6 font-medium">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-accent/80 shrink-0" />
                                        <span>{new Date(cls.start_time).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-accent/80 shrink-0" />
                                        <span>
                                            {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(cls.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-accent/80 shrink-0" />
                                        <span className="truncate">{cls.location || "Online Auditorium"}</span>
                                    </div>
                                </div>
                            </div>

                            {enrolled ? (
                                <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/5 select-none">
                                    <UserCheck className="w-4.5 h-4.5" />
                                    Active Enrollment
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleEnroll(cls.session_id)}
                                    disabled={enrollingId !== null}
                                    className="w-full bg-gradient-to-r from-accent to-purple-600 hover:from-accent/95 hover:to-purple-600/95 text-white font-extrabold py-3 text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {enrollingId === cls.session_id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Enrolling Student...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            Enroll in Subject
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    );
                })}

                {sessions.length === 0 && (
                    <div className="col-span-full py-20 text-center text-muted bg-[var(--glass-bg)] border border-[var(--glass-border)] border-dashed rounded-2xl max-w-xl mx-auto w-full">
                        <Calendar className="w-14 h-14 text-muted mx-auto mb-4 opacity-40 animate-pulse" />
                        <h3 className="text-lg font-bold text-foreground mb-1">No Academic Subjects Registered</h3>
                        <p className="text-muted text-sm max-w-sm mx-auto px-6">
                            There are currently no active lecture sessions or curriculum schedules configured by organization admins.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
