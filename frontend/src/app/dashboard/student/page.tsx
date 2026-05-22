"use client";
import React, { useEffect, useState } from "react";
import { getStudentStats, StudentStats } from "@/services/dashboardService";
import { getSessions, Session } from "@/services/sessionService";
import { Clock, MapPin, Video, LogIn, Calendar, X, Loader2, VideoOff } from "lucide-react";
import { DeviceCameraStreamer } from "@/components/CameraStream";
import Portal from "@/components/Portal";
import { motion, AnimatePresence } from "framer-motion";

export default function StudentDashboard() {
    const [stats, setStats] = useState<StudentStats | null>(null);
    const [classes, setClasses] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [streamingCameraId, setStreamingCameraId] = useState<string | null>(null);
    const [streamingSessionId, setStreamingSessionId] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [statsData, classesData] = await Promise.all([
                getStudentStats(),
                getSessions()
            ]);
            setStats(statsData);
            setClasses(classesData);
        } catch (error) {
            console.error("Failed to load student dashboard data", error);
        } finally {
            setLoading(false);
        }
    }

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

    if (loading) return <div className="p-8 text-center text-muted">Loading dashboard...</div>;

    // Sort classes: Active first, then upcoming by date
    const activeClasses = classes.filter(isActive);
    const upcomingClasses = classes.filter(isUpcoming).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-foreground">
                Student Dashboard
            </h2>

            {/* Active Classes Section */}
            {activeClasses.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        Live Now
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeClasses.map((cls) => (
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
                                    </div>
                                    {cls.camera_id ? (
                                        <button
                                            onClick={() => {
                                                setStreamingCameraId(cls.camera_id!.toString());
                                                setStreamingSessionId(cls.session_id);
                                            }}
                                            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            <LogIn className="w-5 h-5" />
                                            Join Class
                                        </button>
                                    ) : (
                                        <button
                                            disabled
                                            className="w-full bg-white/5 text-muted border border-glass-border text-sm font-medium py-3 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
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
                    <div className="bg-[var(--glass-bg)] backdrop-blur-md overflow-hidden shadow-sm rounded-xl border border-[var(--glass-border)] p-6">
                        <dt className="text-sm font-medium text-muted truncate">My Attendance Rate</dt>
                        <dd className="mt-2 text-3xl font-bold text-green-400">{stats.attendance_rate}%</dd>
                    </div>
                    <div className="bg-[var(--glass-bg)] backdrop-blur-md overflow-hidden shadow-sm rounded-xl border border-[var(--glass-border)] p-6">
                        <dt className="text-sm font-medium text-muted truncate">Classes Missed</dt>
                        <dd className="mt-2 text-3xl font-bold text-red-400">{stats.classes_missed}</dd>
                    </div>
                </div>
            )}

            {/* Upcoming Classes */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold text-foreground">Upcoming Classes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcomingClasses.map((cls) => (
                        <div key={cls.session_id} className="bg-[var(--glass-bg)] backdrop-blur-md rounded-xl shadow-sm border border-[var(--glass-border)] p-6 hover:shadow-md transition-shadow hover:border-accent/30">
                            <h4 className="text-lg font-bold text-foreground mb-2">{cls.session_name}</h4>
                            <div className="space-y-2 text-sm text-muted">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-muted" />
                                    <span>{new Date(cls.start_time).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-muted" />
                                    <span>
                                        {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-muted" />
                                    <span>{cls.location || "Online"}</span>
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

            {/* Recent Attendance (Existing) */}
            {stats && (
                <div className="bg-[var(--glass-bg)] backdrop-blur-md shadow-sm border border-[var(--glass-border)] rounded-xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-[var(--glass-border)] bg-[var(--glass-highlight)]">
                        <h3 className="text-lg leading-6 font-semibold text-foreground">Recent History</h3>
                    </div>
                    <div className="divide-y divide-[var(--glass-border)]">
                        {stats.recent_history.length === 0 ? (
                            <div className="px-6 py-8 text-center text-muted">No attendance records found.</div>
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

            {/* Stream Class Sidebar Drawer / Modal */}
            <Portal>
                <AnimatePresence>
                    {streamingCameraId && (
                        <>
                            {/* Backdrop */}
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
                            
                            {/* Large Stream Modal */}
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
                                        <DeviceCameraStreamer
                                            cameraId={streamingCameraId}
                                            sessionId={streamingSessionId ?? undefined}
                                        />
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
