"use client";
import React, { useEffect, useState } from "react";
import { getTeacherStats, TeacherStats } from "@/services/dashboardService";
import { getSessions, createSession, Session } from "@/services/sessionService";
import { getCameras, Camera } from "@/services/cameraService";
import { Plus, Calendar, MapPin, Video, VideoOff, Clock, X, Loader2, Sparkles } from "lucide-react";
import { DeviceCameraStreamer } from "@/components/CameraStream";

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
            <div 
                key={cls.session_id} 
                className="glass-card p-6 flex flex-col justify-between"
                style={{ animationDelay: `${index * 100}ms` }}
            >
                <div className="flex justify-between items-start mb-6">
                    <h4 className="text-xl font-semibold text-foreground tracking-tight line-clamp-2">{cls.session_name}</h4>
                    <span className={`text-xs px-3 py-1.5 rounded-full font-medium tracking-wide shadow-sm flex items-center gap-1.5 transition-all whitespace-nowrap ml-3 ${
                            isEnded
                                ? 'bg-white/5 text-white/50 border border-white/10'
                                : isLive
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-pulse'
                                : 'bg-accent/10 text-accent font-semibold border border-accent/30 shadow-[0_0_10px_rgba(189,244,255,0.15)]'
                        }`}>
                        {isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>}
                        {isEnded ? 'Ended' : isLive ? 'Live' : 'Scheduled'}
                    </span>
                </div>

                <div className="space-y-3 text-sm text-muted-bright mb-6">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-accent/70" />
                        <span>{new Date(cls.start_time).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-accent/70" />
                        <span>{new Date(cls.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(cls.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-accent/70" />
                        <span className="truncate">{cls.location || "Online"}</span>
                    </div>
                    {cls.camera_id && (
                        <div className="flex items-center gap-3">
                            <Video className="w-4 h-4 text-accent/70" />
                            <span className="truncate">
                                {cameras.find(c => c.camera_id === cls.camera_id)?.location || `Cam ID: ${cls.camera_id}`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                {isEnded ? (
                    <button
                        onClick={() => window.location.href = `/dashboard/attendance?sessionId=${cls.session_id}`}
                        className="w-full bg-secondary text-foreground hover:text-accent border border-white/10 hover:border-accent/30 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 group"
                    >
                        <Calendar className="w-4 h-4 group-hover:scale-110 transition-transform" /> Attendance Report
                    </button>
                ) : cls.camera_id ? (
                    <button
                        onClick={() => {
                        setStreamingCameraId(cls.camera_id!.toString());
                        setStreamingSessionId(cls.session_id);
                    }}
                        className={`w-full font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group ${isLive ? 'bg-gradient-to-r from-accent to-accent-dark text-black hover:shadow-[0_0_20px_rgba(189,244,255,0.4)]' : 'bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 hover:border-accent/50'}`}
                    >
                        <Video className={`w-4 h-4 group-hover:animate-bounce`} /> {isLive ? 'Join Stream' : 'Start Stream'}
                    </button>
                ) : (
                    <button
                        disabled
                        className="w-full bg-secondary/50 text-white/30 border border-white/5 font-medium py-3 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                        <VideoOff className="w-4 h-4" /> No Camera Assigned
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`space-y-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h2 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent via-white to-violet drop-shadow-md tracking-tight">
                        Teacher Dashboard
                    </h2>
                    <p className="text-muted-bright mt-2 text-sm md:text-base">Manage your scheduled sessions, cameras, and attendance tracking.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-accent to-accent-dark hover:from-accent-dark hover:to-accent text-secondary px-6 py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(189,244,255,0.25)] hover:shadow-[0_0_25px_rgba(189,244,255,0.5)] hover:-translate-y-0.5 font-bold"
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
                        <dd className="mt-4 text-5xl font-extrabold text-white tracking-tighter">{stats.total_classes}</dd>
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
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                    <div className="w-2 h-6 bg-accent rounded-full shadow-[0_0_10px_rgba(189,244,255,0.5)]"></div>
                    <h3 className="text-2xl font-bold text-white tracking-tight">Active & Upcoming</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {activeClasses.map((cls, idx) => renderClassCard(cls, idx))}
                    {activeClasses.length === 0 && (
                        <div className="col-span-full text-center py-16 glass-card border-[1px] border-dashed border-white/10">
                            <p className="text-muted-bright text-lg">No active or scheduled classes at the moment.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Past Classes List */}
            {pastClasses.length > 0 && (
                <div className="space-y-6 pt-6">
                    <div className="flex items-center gap-3 border-b border-white/10 pb-4 opacity-75">
                        <div className="w-2 h-6 bg-white/20 rounded-full"></div>
                        <h3 className="text-2xl font-bold text-white/70 tracking-tight">Past Classes</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 opacity-60 hover:opacity-100 transition-opacity duration-500">
                        {pastClasses.map((cls, idx) => renderClassCard(cls, idx))}
                    </div>
                </div>
            )}

            {/* Create Class Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
                    <div className="bg-secondary/90 border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md p-8 relative animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-5 right-5 text-muted-bright hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-2xl font-bold text-white mb-6 tracking-tight">Schedule Session</h3>

                        <form onSubmit={handleCreateClass} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-muted-bright mb-2">Class Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-background/50 text-white rounded-xl border border-white/10 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all placeholder:text-white/20"
                                    placeholder="e.g. CS101 - Intro to AI"
                                    value={newClass.session_name}
                                    onChange={(e) => setNewClass({ ...newClass, session_name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-bright mb-2">Start</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        style={{ colorScheme: 'dark' }}
                                        className="w-full px-4 py-3 bg-background/50 text-white rounded-xl border border-white/10 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                                        value={newClass.start_time}
                                        onChange={(e) => setNewClass({ ...newClass, start_time: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-bright mb-2">End</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        style={{ colorScheme: 'dark' }}
                                        className="w-full px-4 py-3 bg-background/50 text-white rounded-xl border border-white/10 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                                        value={newClass.end_time}
                                        onChange={(e) => setNewClass({ ...newClass, end_time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-muted-bright mb-2">Location</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-background/50 text-white rounded-xl border border-white/10 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all placeholder:text-white/20"
                                    placeholder="e.g. Room 304 or Zoom Link"
                                    value={newClass.location}
                                    onChange={(e) => setNewClass({ ...newClass, location: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-muted-bright mb-2">Camera Integration</label>
                                <select
                                    className="w-full px-4 py-3 bg-background/50 text-white rounded-xl border border-white/10 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all appearance-none"
                                    value={newClass.camera_id}
                                    onChange={(e) => setNewClass({ ...newClass, camera_id: e.target.value })}
                                >
                                    <option value="" className="bg-secondary text-white">No camera tracking</option>
                                    {cameras.map(cam => (
                                        <option key={cam.camera_id} value={cam.camera_id} className="bg-secondary text-white">
                                            {cam.location} - {cam.description || cam.camera_type} {cam.connection_url ? `(${cam.connection_url.substring(0,20)}...)` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="w-full bg-gradient-to-r from-accent to-accent-dark hover:from-accent-dark hover:to-accent text-secondary shadow-[0_0_15px_rgba(189,244,255,0.3)] hover:shadow-[0_0_25px_rgba(189,244,255,0.5)] font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
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
                </div>
            )}

            {/* Stream Class Modal */}
            {streamingCameraId && (
                <div className="fixed inset-0 bg-background/90 backdrop-blur-xl z-[100] flex items-center justify-center p-2 sm:p-8">
                    <div className="glass-card shadow-[0_0_50px_rgba(0,0,0,0.8)] w-full max-w-6xl overflow-hidden relative animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        <div className="p-4 sm:p-6 border-b border-white/10 flex justify-between items-center bg-secondary/30">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3 tracking-tight">
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
                                className="text-muted-bright hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 sm:p-2.5 rounded-full"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>

                        <div className="flex-1 w-full p-4 sm:p-6 overflow-y-auto custom-scrollbar">
                            <div className="w-full h-full min-h-[500px]">
                                <DeviceCameraStreamer
                                    cameraId={streamingCameraId}
                                    sessionId={streamingSessionId ?? undefined}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

