"use client";
import React, { useEffect, useState } from "react";
import { getTeacherStats, TeacherStats } from "@/services/dashboardService";
import { getSessions, createSession, Session } from "@/services/sessionService";
import { getCameras, Camera } from "@/services/cameraService";
import { Plus, Calendar, MapPin, Video, VideoOff, Clock, X, Loader2, Sparkles } from "lucide-react";
import { DeviceCameraStreamer } from "@/components/CameraStream";
import Portal from "@/components/Portal";
import { motion, AnimatePresence } from "framer-motion";

export default function TeacherDashboard() {
    const [stats, setStats] = useState<TeacherStats | null>(null);
    const [classes, setClasses] = useState<Session[]>([]);
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [streamingCameraId, setStreamingCameraId] = useState<string | null>(null);
    const [streamingSessionId, setStreamingSessionId] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    // Form State
    const [newClass, setNewClass] = useState({
        session_name: "",
        start_time: "",
        end_time: "",
        location: "",
        camera_id: ""
    });

    useEffect(() => {
        setMounted(true);
        loadData();
    }, []);

    async function loadData() {
        try {
            const [statsData, classesData, camerasData] = await Promise.all([
                getTeacherStats(),
                getSessions(),
                getCameras()
            ]);
            setStats(statsData);
            setClasses(classesData);
            setCameras(camerasData);
        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            setLoading(false);
        }
    }

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await createSession({
                ...newClass,
                camera_id: newClass.camera_id ? Number(newClass.camera_id) : undefined
            });
            await loadData(); // Refresh list
            setIsModalOpen(false);
            setNewClass({ session_name: "", start_time: "", end_time: "", location: "", camera_id: "" });
        } catch (error: any) {
            console.error("Failed to create class", error);
            const msg = error.response?.data?.detail || "Failed to create class. Please check fields.";
            alert(`Error: ${msg}`);
        } finally {
            setCreating(false);
        }
    };

    if (loading) return (
        <div className="flex h-[60vh] w-full items-center justify-center">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
        </div>
    );

    const activeClasses = classes.filter(cls => new Date(cls.end_time) >= new Date());
    const pastClasses = classes.filter(cls => new Date(cls.end_time) < new Date());
    
    const renderClassCard = (cls: Session, index: number) => {
        const isLive = new Date(cls.start_time) <= new Date() && new Date(cls.end_time) >= new Date();
        const isEnded = new Date(cls.end_time) < new Date();
        
        return (
            <div key={cls.session_id} className="uiverse-card flex flex-col" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="top-section">
                    <div className="border"></div>
                    <div className="icons">
                        <div className="logo text-white font-bold text-sm">
                           {isLive && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse mr-2 inline-block"></span>}
                           {isEnded ? 'Ended' : isLive ? 'Live' : 'Scheduled'}
                        </div>
                        <div className="social-media">
                           <Sparkles className="w-5 h-5 text-white/70" />
                        </div>
                    </div>
                </div>
                <div className="bottom-section flex-1 flex flex-col">
                    <span className="title truncate px-2">{cls.session_name}</span>
                    <div className="row row1">
                        <div className="item">
                            <span className="big-text">{new Date(cls.start_time).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                            <span className="regular-text">Date</span>
                        </div>
                        <div className="item">
                            <span className="big-text">{new Date(cls.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <span className="regular-text">Start</span>
                        </div>
                        <div className="item">
                            <span className="big-text">{new Date(cls.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <span className="regular-text">End</span>
                        </div>
                    </div>
                    
                    <div className="mt-4 px-2 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-bright">
                            <MapPin className="w-3 h-3 text-accent" />
                            <span className="truncate">{cls.location || "Online"}</span>
                        </div>
                        {cls.camera_id && (
                            <div className="flex items-center gap-2 text-xs text-muted-bright">
                                <Video className="w-3 h-3 text-accent" />
                                <span className="truncate">
                                    {cameras.find(c => c.camera_id === cls.camera_id)?.location || `Cam ID: ${cls.camera_id}`}
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className="mt-auto pt-4 px-2 pb-2">
                        {isEnded ? (
                            <button
                                onClick={() => window.location.href = `/dashboard/attendance?sessionId=${cls.session_id}`}
                                className="w-full bg-secondary text-foreground hover:text-accent border border-[var(--glass-border)] hover:border-accent/30 text-sm font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                <Calendar className="w-4 h-4" /> Report
                            </button>
                        ) : cls.camera_id ? (
                            <button
                                onClick={() => {
                                    setStreamingCameraId(cls.camera_id!.toString());
                                    setStreamingSessionId(cls.session_id);
                                }}
                                className={`w-full text-sm font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${isLive ? 'bg-gradient-to-r from-accent to-accent-dark text-black hover:shadow-[0_0_15px_rgba(189,244,255,0.4)]' : 'bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 hover:border-accent/50'}`}
                            >
                                <Video className="w-4 h-4" /> {isLive ? 'Join Stream' : 'Start Stream'}
                            </button>
                        ) : (
                            <button
                                disabled
                                className="w-full bg-[var(--glass-bg)] text-muted border border-[var(--glass-border)] text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
                            >
                                <VideoOff className="w-4 h-4" /> No Camera
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h2 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent via-foreground to-violet drop-shadow-md tracking-tight">
                        Teacher Dashboard
                    </h2>
                    <p className="text-muted-bright mt-2 text-sm md:text-base">Manage your scheduled sessions, cameras, and attendance tracking.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center w-full sm:w-auto gap-2 bg-gradient-to-r from-accent to-accent-dark hover:from-accent-dark hover:to-accent text-secondary px-6 py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(189,244,255,0.25)] hover:shadow-[0_0_25px_rgba(189,244,255,0.5)] hover:-translate-y-0.5 font-bold"
                >
                    <Plus className="w-5 h-5 flex-shrink-0" />
                    <span>Create Class</span>
                </button>
            </div>

            {/* Stats Row */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-card p-6 flex flex-col justify-center border-l-4 border-l-accent text-center md:text-left">
                        <dt className="text-sm font-medium text-muted-bright tracking-wider uppercase flex items-center justify-center md:justify-start gap-2">
                            <Sparkles className="w-4 h-4 text-accent" /> Total Classes
                        </dt>
                        <dd className="mt-4 text-5xl font-extrabold text-foreground tracking-tighter">{stats.total_classes}</dd>
                    </div>
                    <div className="glass-card p-6 flex flex-col justify-center border-l-4 border-l-violet text-center md:text-left">
                        <dt className="text-sm font-medium text-muted-bright tracking-wider uppercase flex items-center justify-center md:justify-start gap-2">
                            <Sparkles className="w-4 h-4 text-violet" /> Avg. Attendance
                        </dt>
                        <dd className="mt-4 text-5xl font-extrabold text-accent tracking-tighter">{stats.avg_attendance}%</dd>
                    </div>
                    <div className="glass-card p-6 flex flex-col justify-center border-l-4 border-l-red-500 text-center md:text-left">
                        <dt className="text-sm font-medium text-muted-bright tracking-wider uppercase flex items-center justify-center md:justify-start gap-2">
                            <Sparkles className="w-4 h-4 text-red-400" /> Endanger Alerts
                        </dt>
                        <dd className="mt-4 text-5xl font-extrabold text-red-400 tracking-tighter">{stats.low_engagement}</dd>
                    </div>
                </div>
            )}

            {/* Active Classes List */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-[var(--glass-border)] pb-4">
                    <div className="w-2 h-6 bg-accent rounded-full shadow-[0_0_10px_var(--color-accent)]"></div>
                    <h3 className="text-2xl font-bold text-foreground tracking-tight">Active & Upcoming</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {activeClasses.map((cls, idx) => renderClassCard(cls, idx))}
                    {activeClasses.length === 0 && (
                        <div className="col-span-full text-center py-16 glass-card border-[1px] border-dashed border-[var(--glass-border)]">
                            <p className="text-muted-bright text-lg">No active or scheduled classes at the moment.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Past Classes List */}
            {pastClasses.length > 0 && (
                <div className="space-y-6 pt-6">
                    <div className="flex items-center gap-3 border-b border-[var(--glass-border)] pb-4 opacity-75">
                        <div className="w-2 h-6 bg-[var(--glass-highlight)] rounded-full"></div>
                        <h3 className="text-2xl font-bold text-foreground/70 tracking-tight">Past Classes</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 opacity-60 hover:opacity-100 transition-opacity duration-500">
                        {pastClasses.map((cls, idx) => renderClassCard(cls, idx))}
                    </div>
                </div>
            )}

            {/* Create Class Sidebar Drawer */}
            <Portal>
                <AnimatePresence>
                    {isModalOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsModalOpen(false)}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                            />
                            
                            {/* Drawer -> Centered Modal */}
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-2xl z-[101] flex flex-col backdrop-blur-2xl rounded-2xl max-h-[90vh]"
                            >
                                <div className="p-6 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--glass-highlight)]">
                                    <h3 className="text-2xl font-bold text-foreground tracking-tight">Schedule Session</h3>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="text-muted-bright hover:text-foreground transition-colors bg-[var(--glass-highlight)] p-2 rounded-full"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    <form onSubmit={handleCreateClass} className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-muted-bright mb-2">Class Name</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full px-4 py-3 bg-[var(--glass-highlight)] text-foreground rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all placeholder:text-muted"
                                                placeholder="e.g. CS101 - Intro to AI"
                                                value={newClass.session_name}
                                                onChange={(e) => setNewClass({ ...newClass, session_name: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-muted-bright mb-2">Start</label>
                                                <input
                                                    type="datetime-local"
                                                    required
                                                    className="w-full px-4 py-3 bg-[var(--glass-highlight)] text-foreground rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-accent/50 outline-none transition-all"
                                                    value={newClass.start_time}
                                                    onChange={(e) => setNewClass({ ...newClass, start_time: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-muted-bright mb-2">End</label>
                                                <input
                                                    type="datetime-local"
                                                    required
                                                    className="w-full px-4 py-3 bg-[var(--glass-highlight)] text-foreground rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-accent/50 outline-none transition-all"
                                                    value={newClass.end_time}
                                                    onChange={(e) => setNewClass({ ...newClass, end_time: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-muted-bright mb-2">Location</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 bg-[var(--glass-highlight)] text-foreground rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-accent/50 outline-none transition-all placeholder:text-muted"
                                                placeholder="e.g. Room 304 or Zoom Link"
                                                value={newClass.location}
                                                onChange={(e) => setNewClass({ ...newClass, location: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-muted-bright mb-2">Camera Integration</label>
                                            <select
                                                className="w-full px-4 py-3 bg-[var(--glass-highlight)] text-foreground rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-accent/50 outline-none transition-all appearance-none"
                                                value={newClass.camera_id}
                                                onChange={(e) => setNewClass({ ...newClass, camera_id: e.target.value })}
                                            >
                                                <option value="" className="bg-secondary text-foreground">No camera tracking</option>
                                                {cameras.map(cam => (
                                                    <option key={cam.camera_id} value={cam.camera_id} className="bg-secondary text-foreground">
                                                        {cam.location} - {cam.description || cam.camera_type}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="pt-4 mt-auto">
                                            <button
                                                type="submit"
                                                disabled={creating}
                                                className="w-full bg-gradient-to-r from-accent to-accent-dark hover:from-accent-dark hover:to-accent text-secondary shadow-[0_0_15px_rgba(189,244,255,0.3)] hover:shadow-[0_0_25px_rgba(189,244,255,0.5)] font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {creating ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Initializing...
                                                    </>
                                                ) : (
                                                    "Confirm Schedule"
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </Portal>

            {/* Stream Class Sidebar Drawer */}
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
                                            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
                                            Live Analysis Stream
                                        </h3>
                                        <p className="text-xs sm:text-sm text-muted-bright mt-1">
                                            AI-powered real-time tracking for Camera #{streamingCameraId}.
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

