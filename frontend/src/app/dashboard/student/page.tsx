"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getStudentStats, StudentStats } from "@/services/dashboardService";
import { getSessions, Session } from "@/services/sessionService";
import { getMyEnrollments, enrollInSession, Enrollment } from "@/services/enrollmentService";
import { getUsers } from "@/services/authService";
import { 
    Clock, MapPin, Video, LogIn, Calendar, X, Loader2, VideoOff, 
    BookOpen, UserCheck, Sparkles, ShieldCheck, CheckCircle2, AlertCircle 
} from "lucide-react";
import Portal from "@/components/Portal";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";

const StreamViewer = dynamic(
    () => import("@/components/CameraStream").then((mod) => mod.StreamViewer),
    { ssr: false, loading: () => <div className="text-center py-10 text-xs text-muted flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-accent" /> Loading live stream viewer...</div> }
);

export default function StudentDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<"schedule" | "enroll">("schedule");
    
    // Core Data States
    const [stats, setStats] = useState<StudentStats | null>(null);
    const [allSessions, setAllSessions] = useState<Session[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [teachers, setTeachers] = useState<Record<number, string>>({});
    
    // UI/Flow States
    const [loading, setLoading] = useState(true);
    const [enrollingId, setEnrollingId] = useState<number | null>(null);
    const [streamingCameraId, setStreamingCameraId] = useState<string | null>(null);
    const [streamingSessionId, setStreamingSessionId] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    async function loadData() {
        setLoading(true);
        setError(null);
        try {
            const [statsData, sessionsData, enrollmentsData, teachersData] = await Promise.all([
                getStudentStats(),
                getSessions(),
                getMyEnrollments(),
                getUsers(2) // Role ID 2 = Teacher
            ]);

            const teacherMap: Record<number, string> = {};
            teachersData.forEach((t: any) => {
                teacherMap[t.user_id] = t.full_name;
            });

            setStats(statsData);
            setAllSessions(sessionsData);
            setEnrollments(enrollmentsData);
            setTeachers(teacherMap);
        } catch (err) {
            console.error("Failed to load student dashboard data:", err);
            setError("Failed to sync available data. Please refresh.");
        } finally {
            setLoading(false);
        }
    }

    const handleEnroll = async (sessionId: number) => {
        if (!user) return;
        setEnrollingId(sessionId);
        setError(null);
        setSuccessMessage(null);
        try {
            const newEnrollment = await enrollInSession(sessionId, user.user_id);
            setEnrollments(prev => [...prev, newEnrollment]);
            
            const sessionName = allSessions.find(s => s.session_id === sessionId)?.session_name || "subject";
            setSuccessMessage(`Successfully enrolled in ${sessionName}!`);
            
            // Re-fetch stats to reflect the new enrollment in engagement analytics
            const statsData = await getStudentStats();
            setStats(statsData);
            
            // Auto fade success message
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            console.error("Enrollment failed:", err);
            setError(err?.response?.data?.detail || "Failed to complete enrollment. Please try again.");
        } finally {
            setEnrollingId(null);
        }
    };

    const isEnrolled = (sessionId: number) => {
        return enrollments.some(e => e.session_id === sessionId);
    };

    const isActive = (cls: Session) => {
        const now = new Date();
        const start = new Date(cls.start_time);
        const end = new Date(cls.end_time);
        return now >= start && now <= end;
    };

    const isUpcoming = (cls: Session) => {
        const now = new Date();
        const start = new Date(cls.start_time);
        return start > now;
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center">
                <Loader2 className="w-10 h-10 text-accent animate-spin" />
            </div>
        );
    }

    // Filter enrolled sessions for schedule tab
    const enrolledSessionIds = new Set(enrollments.map(e => e.session_id));
    const myClasses = allSessions.filter(cls => enrolledSessionIds.has(cls.session_id));
    
    // Sort my classes
    const liveClasses = myClasses.filter(isActive);
    const upcomingClasses = myClasses.filter(isUpcoming).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return (
        <div className="space-y-8 max-w-7xl mx-auto px-4 md:px-0 pb-12 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent via-foreground to-purple-400 drop-shadow-md tracking-tight">
                        Student Dashboard
                    </h2>
                    <p className="text-muted text-sm mt-1">
                        View live check-ins, attend online lectures, and enroll in your academic subject courses.
                    </p>
                </div>
                <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] px-4 py-2.5 rounded-xl text-xs font-semibold text-accent flex items-center gap-2 w-fit">
                    <ShieldCheck className="w-4.5 h-4.5" />
                    Student Portal Registered
                </div>
            </div>

            {/* Error and Success Banners */}
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

            {/* Tabs */}
            <div className="flex overflow-x-auto no-scrollbar space-x-1 bg-[var(--glass-bg)] p-1 rounded-xl backdrop-blur-md border border-[var(--glass-border)] w-full sm:w-fit max-w-full">
                <button
                    onClick={() => {
                        setActiveTab("schedule");
                        setError(null);
                        setSuccessMessage(null);
                    }}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                        activeTab === "schedule" ? "bg-accent text-black shadow-lg shadow-accent/25" : "text-muted hover:text-foreground"
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        My Schedule & History
                    </div>
                </button>
                <button
                    onClick={() => {
                        setActiveTab("enroll");
                        setError(null);
                        setSuccessMessage(null);
                    }}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                        activeTab === "enroll" ? "bg-accent text-black shadow-lg shadow-accent/25" : "text-muted hover:text-foreground"
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Subject Catalog (Enroll)
                    </div>
                </button>
            </div>

            {activeTab === "schedule" && (
                <div className="space-y-8">
                    {/* Live Classes Section */}
                    {liveClasses.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                                Live Now
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {liveClasses.map((cls) => (
                                    <div key={cls.session_id} className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-xl shadow-md border border-green-500/20 p-6 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                            <Video className="w-24 h-24 text-green-400" />
                                        </div>
                                        <div className="relative z-10">
                                            <h4 className="text-2xl font-bold text-white mb-2">{cls.session_name}</h4>
                                            <div className="space-y-2 text-sm text-foreground mb-6">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-green-400" />
                                                    <span>
                                                        {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(cls.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-green-400" />
                                                    <span>{cls.location || "Online"}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-bold mt-1">
                                                    <span className={`px-2 py-0.5 rounded border uppercase tracking-wider text-[10px] ${
                                                        cls.class_type === "offline"
                                                            ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                                                            : "bg-green-500/15 border-green-500/30 text-green-400"
                                                    }`}>
                                                        {cls.class_type === "offline" ? "Offline" : "Online / Hybrid"}
                                                    </span>
                                                </div>
                                            </div>
                                            {cls.class_type === "offline" ? (
                                                <div className="w-full text-center py-3 text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-lg uppercase tracking-wider select-none">
                                                    Offline Session - Physical Attendance
                                                </div>
                                            ) : cls.camera_id ? (
                                                <button
                                                    onClick={() => {
                                                        setStreamingCameraId(cls.camera_id!.toString());
                                                        setStreamingSessionId(cls.session_id);
                                                    }}
                                                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                                                >
                                                    <LogIn className="w-5 h-5" />
                                                    Join Class
                                                </button>
                                            ) : (
                                                <button
                                                    disabled
                                                    className="w-full bg-white/5 text-muted border border-[var(--glass-border)] text-sm font-medium py-3 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed select-none"
                                                >
                                                    <VideoOff className="w-4 h-4" /> No Camera Integration
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stats Overview */}
                    {stats && (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <div className="bg-[var(--glass-bg)] backdrop-blur-md overflow-hidden shadow-sm rounded-xl border border-[var(--glass-border)] p-6 border-l-4 border-l-green-400">
                                <dt className="text-sm font-medium text-muted truncate uppercase tracking-wider">My Attendance Rate</dt>
                                <dd className="mt-2 text-4xl font-black text-green-400 tracking-tight">{stats.attendance_rate}%</dd>
                            </div>
                            <div className="bg-[var(--glass-bg)] backdrop-blur-md overflow-hidden shadow-sm rounded-xl border border-[var(--glass-border)] p-6 border-l-4 border-l-red-500">
                                <dt className="text-sm font-medium text-muted truncate uppercase tracking-wider">Classes Missed</dt>
                                <dd className="mt-2 text-4xl font-black text-red-400 tracking-tight">{stats.classes_missed}</dd>
                            </div>
                        </div>
                    )}

                    {/* Upcoming Classes */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold text-foreground">Upcoming Enrolled Classes</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {upcomingClasses.map((cls) => (
                                <div key={cls.session_id} className="bg-[var(--glass-bg)] backdrop-blur-md rounded-xl shadow-sm border border-[var(--glass-border)] p-6 hover:shadow-md transition-shadow hover:border-accent/30 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-lg font-bold text-foreground line-clamp-1">{cls.session_name}</h4>
                                            <span className={`px-2 py-0.5 rounded border uppercase tracking-wider text-[8px] font-black ${
                                                cls.class_type === "offline"
                                                    ? "bg-purple-500/15 border-purple-500/25 text-purple-400"
                                                    : "bg-accent/15 border-accent/25 text-accent"
                                            }`}>
                                                {cls.class_type === "offline" ? "Offline" : "Online"}
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-xs text-muted font-medium">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-accent/80" />
                                                <span>{new Date(cls.start_time).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-accent/80" />
                                                <span>
                                                    {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-accent/80" />
                                                <span>{cls.location || "Online"}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {upcomingClasses.length === 0 && (
                                <div className="col-span-full py-8 text-center text-muted bg-[var(--glass-highlight)] rounded-xl border border-[var(--glass-border)]">
                                    No upcoming classes scheduled.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Attendance */}
                    {stats && (
                        <div className="bg-[var(--glass-bg)] backdrop-blur-md shadow-sm border border-[var(--glass-border)] rounded-xl overflow-hidden">
                            <div className="px-6 py-5 border-b border-[var(--glass-border)] bg-[var(--glass-highlight)]">
                                <h3 className="text-lg leading-6 font-semibold text-foreground">Recent Check-In History</h3>
                            </div>
                            <div className="divide-y divide-[var(--glass-border)]">
                                {stats.recent_history.length === 0 ? (
                                    <div className="px-6 py-8 text-center text-muted">No check-in history found.</div>
                                ) : (
                                    stats.recent_history.map((record) => (
                                        <div key={record.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--glass-highlight)] transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-foreground">{record.date}</span>
                                                <span className="text-xs text-muted">{record.time}</span>
                                            </div>
                                            <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${record.status === 'Present'
                                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                                }`}>
                                                {record.status}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === "enroll" && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {allSessions.map((cls) => {
                            const enrolled = isEnrolled(cls.session_id);
                            const teacherName = teachers[cls.created_by || 0] || "Faculty Professor";
                            const isUpcomingSession = new Date(cls.start_time) > new Date();

                            return (
                                <div 
                                    key={cls.session_id} 
                                    className={`glass-card p-6 border relative overflow-hidden transition-all duration-300 flex flex-col justify-between group ${
                                        enrolled 
                                            ? "border-emerald-500/30 bg-emerald-950/5 shadow-[0_0_20px_-10px_rgba(16,185,129,0.2)]" 
                                            : "hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5"
                                    }`}
                                >
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
                                            {isUpcomingSession && (
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

                        {allSessions.length === 0 && (
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
            )}

            {/* Stream Class Portal */}
            <Portal>
                <AnimatePresence>
                    {streamingCameraId && (
                        <>
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => {
                                    setStreamingCameraId(null);
                                    setStreamingSessionId(null);
                                }}
                                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                            />
                            
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: "spring", damping: 30, stiffness: 200 }}
                                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full lg:w-[85%] xl:w-[75%] bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-2xl z-[101] flex flex-col backdrop-blur-2xl rounded-2xl max-h-[95vh]"
                            >
                                <div className="p-4 sm:p-6 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--glass-highlight)]">
                                    <div>
                                        <h3 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-3 tracking-tight">
                                            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]"></span>
                                            Join Class & Check Attendance
                                        </h3>
                                        <p className="text-xs sm:text-sm text-muted-bright mt-1">
                                            Keep your camera streaming. We will verify your face to automatically mark you present.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setStreamingCameraId(null);
                                            setStreamingSessionId(null);
                                        }}
                                        className="text-muted-bright hover:text-foreground transition-colors bg-[var(--glass-highlight)] p-2 sm:p-2.5 rounded-full"
                                    >
                                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                                    </button>
                                </div>

                                <div className="flex-1 w-full p-2 sm:p-6 overflow-y-auto custom-scrollbar">
                                    <div className="w-full min-h-full glass-card border-none rounded-none sm:rounded-xl overflow-hidden shadow-inner">
                                        <div className="w-full min-h-[400px] flex flex-col items-center justify-center bg-black/40 rounded-xl relative p-4 border border-[var(--glass-border)]">
                                            <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative shadow-inner ring-1 ring-white/10">
                                                <StreamViewer 
                                                    cameraId={streamingCameraId} 
                                                    onClose={() => {
                                                        setStreamingCameraId(null);
                                                        setStreamingSessionId(null);
                                                    }}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-bright mt-4 text-center">
                                                Viewing live class stream for Camera #{streamingCameraId}.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </Portal>
        </div>
    );
}
