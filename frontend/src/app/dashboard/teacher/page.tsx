"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getTeacherStats, TeacherStats } from "@/services/dashboardService";
import { getSessions, createSession, requestSubject, Session, updateSession } from "@/services/sessionService";
import { getCameras, Camera, addCamera } from "@/services/cameraService";
import { Plus, Calendar, MapPin, Video, VideoOff, Clock, X, Loader2, Sparkles, AlertCircle } from "lucide-react";
import Portal from "@/components/Portal";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";

const DeviceCameraStreamer = dynamic(
    () => import("@/components/CameraStream").then((mod) => mod.DeviceCameraStreamer),
    { ssr: false, loading: () => <div className="text-center py-10 text-xs text-muted flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-accent" /> Loading camera streamer...</div> }
);

const StreamViewer = dynamic(
    () => import("@/components/CameraStream").then((mod) => mod.StreamViewer),
    { ssr: false, loading: () => <div className="text-center py-10 text-xs text-muted flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-accent" /> Loading live stream viewer...</div> }
);

const QRCode = dynamic(() => import("react-qr-code"), { ssr: false });

export default function TeacherDashboard() {
    const [stats, setStats] = useState<TeacherStats | null>(null);
    const [classes, setClasses] = useState<Session[]>([]);
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [requestingSubject, setRequestingSubject] = useState(false);
    const [streamingCameraId, setStreamingCameraId] = useState<string | null>(null);
    const [streamingSessionId, setStreamingSessionId] = useState<number | null>(null);
    const [linkingSessionId, setLinkingSessionId] = useState<number | null>(null);
    const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
    const [linkingCameraId, setLinkingCameraId] = useState<string>("");
    const [linking, setLinking] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [hostUrl, setHostUrl] = useState("");

    const [newSubject, setNewSubject] = useState({ subject_name: "", description: "" });

    // Form State
    const [newClass, setNewClass] = useState({
        session_name: "",
        start_time: "",
        end_time: "",
        location: "",
        camera_id: "",
        class_type: "online"
    });

    useEffect(() => {
        setMounted(true);
        loadData();
        if (typeof window !== "undefined") setHostUrl(window.location.origin);
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
            let finalCameraId: number | undefined = undefined;

            if (newClass.camera_id === "virtual_device" || newClass.camera_id === "virtual_mobile") {
                const isMobile = newClass.camera_id === "virtual_mobile";
                // Register a new camera device on-the-fly
                const autoCam = await addCamera({
                    camera_type: isMobile ? "mobile" : "device",
                    location: `${isMobile ? "Phone" : "Webcam"} Camera (${newClass.session_name || "Class"})`,
                    description: "Automatically integrated on class creation",
                    connection_url: isMobile ? "Mobile cast" : "Device stream"
                });
                finalCameraId = autoCam.camera_id;
            } else if (newClass.camera_id) {
                finalCameraId = Number(newClass.camera_id);
            }

            const createdSession = await createSession({
                ...newClass,
                camera_id: finalCameraId
            });
            await loadData(); // Refresh list
            setIsModalOpen(false);
            setNewClass({ session_name: "", start_time: "", end_time: "", location: "", camera_id: "", class_type: "online" });

            // Auto start stream if camera_id is present
            if (createdSession && createdSession.camera_id) {
                setStreamingCameraId(createdSession.camera_id.toString());
                setStreamingSessionId(createdSession.session_id);
            }
        } catch (error: any) {
            console.error("Failed to create class", error);
            let msg = "Failed to create class. Please check fields.";
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    msg = error.response.data.detail
                        .map((err: any) => {
                            const field = err.loc ? err.loc[err.loc.length - 1] : "field";
                            return `${field.replace("_", " ")}: ${err.msg}`;
                        })
                        .join("\n");
                } else if (typeof error.response.data.detail === "string") {
                    msg = error.response.data.detail;
                }
            }
            alert(`Error:\n${msg}`);
        } finally {
            setCreating(false);
        }
    };

    const handleRequestSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        setRequestingSubject(true);
        try {
            await requestSubject(newSubject.subject_name, newSubject.description);
            alert("Subject catalog request submitted successfully to your organization administrator!");
            setIsSubjectModalOpen(false);
            setNewSubject({ subject_name: "", description: "" });
        } catch (error: any) {
            console.error("Failed to request subject", error);
            let msg = "Failed to submit request.";
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    msg = error.response.data.detail
                        .map((err: any) => {
                            const field = err.loc ? err.loc[err.loc.length - 1] : "field";
                            return `${field.replace("_", " ")}: ${err.msg}`;
                        })
                        .join("\n");
                } else if (typeof error.response.data.detail === "string") {
                    msg = error.response.data.detail;
                }
            }
            alert(`Error:\n${msg}`);
        } finally {
            setRequestingSubject(false);
        }
    };

    const openLinkCameraModal = (sessionId: number) => {
        setLinkingSessionId(sessionId);
        setIsLinkingModalOpen(true);
        setLinkingCameraId("");
    };

    const handleLinkCamera = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!linkingSessionId || !linkingCameraId) return;
        setLinking(true);
        try {
            await updateSession(linkingSessionId, {
                camera_id: Number(linkingCameraId)
            });
            await loadData(); // Refresh list
            setIsLinkingModalOpen(false);
            setLinkingSessionId(null);
            setLinkingCameraId("");
        } catch (error: any) {
            console.error("Failed to link camera", error);
            let msg = "Failed to link camera to class.";
            if (error.response?.data?.detail) {
                if (Array.isArray(error.response.data.detail)) {
                    msg = error.response.data.detail
                        .map((err: any) => {
                            const field = err.loc ? err.loc[err.loc.length - 1] : "field";
                            return `${field.replace("_", " ")}: ${err.msg}`;
                        })
                        .join("\n");
                } else if (typeof error.response.data.detail === "string") {
                    msg = error.response.data.detail;
                }
            }
            alert(`Error:\n${msg}`);
        } finally {
            setLinking(false);
        }
    };

    const handleAutoCreateAndLink = async (type: "device" | "mobile") => {
        if (!linkingSessionId) return;
        setLinking(true);
        try {
            const targetSession = classes.find(c => c.session_id === linkingSessionId);
            const sessionName = targetSession ? targetSession.session_name : "Class";
            
            // Auto create camera
            const autoCam = await addCamera({
                camera_type: type,
                location: `${type === "mobile" ? "Phone" : "Webcam"} Camera (${sessionName})`,
                description: "Linked on-the-fly",
                connection_url: type === "mobile" ? "Mobile cast" : "Device stream"
            });
            
            // Link to session
            await updateSession(linkingSessionId, {
                camera_id: autoCam.camera_id
            });
            
            await loadData();
            setIsLinkingModalOpen(false);
            setLinkingSessionId(null);
            setLinkingCameraId("");
        } catch (error: any) {
            console.error("Failed to auto create and link camera", error);
            alert("Error integrating camera feed.");
        } finally {
            setLinking(false);
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
                            {cls.is_approved === false ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-yellow-400 bg-yellow-500/10 border border-yellow-500/25 px-1.5 py-0.5 rounded leading-none">
                                    <Clock className="w-2.5 h-2.5" /> Pending Approval
                                </span>
                            ) : (
                                <>
                                    {isLive && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse mr-2 inline-block"></span>}
                                    {isEnded ? 'Ended' : isLive ? 'Live' : 'Scheduled'}
                                </>
                            )}
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
                            <span className="big-text">{new Date(cls.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            <span className="regular-text">Date</span>
                        </div>
                        <div className="item">
                            <span className="big-text">{new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="regular-text">Start</span>
                        </div>
                        <div className="item">
                            <span className="big-text">{new Date(cls.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="regular-text">End</span>
                        </div>
                    </div>

                    <div className="mt-4 px-2 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-bright">
                            <MapPin className="w-3 h-3 text-accent" />
                            <span className="truncate">{cls.location || "Online"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold">
                            <span className={`px-2 py-0.5 rounded border uppercase tracking-wider ${cls.class_type === "offline"
                                    ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                                    : "bg-accent/15 border-accent/30 text-accent"
                                }`}>
                                {cls.class_type === "offline" ? "Offline Session" : "Online / Hybrid"}
                            </span>
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
                        {cls.is_approved === false ? (
                            <button
                                disabled
                                className="w-full bg-[var(--glass-bg)] text-muted border border-[var(--glass-border)] text-sm font-medium py-2 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed select-none"
                            >
                                <Clock className="w-4 h-4 text-yellow-400" /> Awaiting Approval
                            </button>
                        ) : isEnded ? (
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
                                <Video className="w-4 h-4" /> {isLive ? 'View Live Stream' : 'Preview Stream'}
                            </button>
                        ) : (
                            <button
                                onClick={() => openLinkCameraModal(cls.session_id)}
                                className="w-full bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 hover:border-violet-500/40 text-sm font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" /> Integrate Camera
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
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setIsSubjectModalOpen(true)}
                        className="flex items-center justify-center w-full sm:w-auto gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-5 py-3.5 rounded-xl transition-all shadow-lg hover:-translate-y-0.5 font-bold cursor-pointer"
                    >
                        <Plus className="w-5 h-5 flex-shrink-0" />
                        <span>Request Subject</span>
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center justify-center w-full sm:w-auto gap-2 bg-gradient-to-r from-accent to-accent-dark hover:from-accent-dark hover:to-accent text-secondary px-5 py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(189,244,255,0.25)] hover:shadow-[0_0_25px_rgba(189,244,255,0.5)] hover:-translate-y-0.5 font-bold cursor-pointer"
                    >
                        <Plus className="w-5 h-5 flex-shrink-0" />
                        <span>Create Class</span>
                    </button>
                </div>
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
                                            <label className="block text-sm font-medium text-muted-bright mb-2">Class Type</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setNewClass({ ...newClass, class_type: "online" })}
                                                    className={`py-3 rounded-xl border font-bold text-sm text-center transition-all cursor-pointer ${newClass.class_type === "online"
                                                            ? "bg-accent/15 border-accent text-accent shadow-[0_0_15px_-5px_var(--color-accent)]"
                                                            : "bg-[var(--glass-highlight)] border-[var(--glass-border)] text-muted-bright hover:border-accent/40"
                                                        }`}
                                                >
                                                    Online / Hybrid
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewClass({ ...newClass, class_type: "offline" })}
                                                    className={`py-3 rounded-xl border font-bold text-sm text-center transition-all cursor-pointer ${newClass.class_type === "offline"
                                                            ? "bg-purple-500/15 border-purple-500/50 text-purple-400 shadow-[0_0_15px_-5px_rgba(168,85,247,0.4)]"
                                                            : "bg-[var(--glass-highlight)] border-[var(--glass-border)] text-muted-bright hover:border-accent/40"
                                                        }`}
                                                >
                                                    Offline / Physical
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-muted-bright mb-2">Camera Integration</label>
                                            <select
                                                className="w-full px-4 py-3 bg-[var(--glass-highlight)] text-foreground rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-accent/50 outline-none transition-all cursor-pointer"
                                                value={newClass.camera_id}
                                                onChange={(e) => setNewClass({ ...newClass, camera_id: e.target.value })}
                                            >
                                                <option value="" className="bg-slate-900 text-white">No camera tracking</option>
                                                
                                                {/* On-the-fly Virtual Camera Options */}
                                                <optgroup label="Create & Integrate New Feed" className="bg-slate-900 text-accent font-bold">
                                                    <option value="virtual_device" className="bg-slate-900 text-white font-normal">
                                                        💻 Device Camera (Local Web Cam)
                                                    </option>
                                                    <option value="virtual_mobile" className="bg-slate-900 text-white font-normal">
                                                        📱 Phone Camera (Mobile Broadcaster)
                                                    </option>
                                                </optgroup>

                                                {cameras.some(cam => cam.camera_type === "device") && (
                                                    <optgroup label="Existing Device Cameras (Webcams)" className="bg-slate-900 text-slate-400 font-bold">
                                                        {cameras.filter(cam => cam.camera_type === "device").map(cam => (
                                                            <option key={cam.camera_id} value={cam.camera_id.toString()} className="bg-slate-900 text-white font-normal">
                                                                {cam.location} - {cam.description || "Local Webcam"}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                
                                                {cameras.some(cam => cam.camera_type === "mobile") && (
                                                    <optgroup label="Existing Phone Cameras (Broadcasters)" className="bg-slate-900 text-slate-400 font-bold">
                                                        {cameras.filter(cam => cam.camera_type === "mobile").map(cam => (
                                                            <option key={cam.camera_id} value={cam.camera_id.toString()} className="bg-slate-900 text-white font-normal">
                                                                {cam.location} - {cam.description || "Mobile Broadcaster"}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}

                                                {cameras.some(cam => cam.camera_type !== "device" && cam.camera_type !== "mobile") && (
                                                    <optgroup label="IP / Network Streams" className="bg-slate-900 text-slate-400 font-bold">
                                                        {cameras.filter(cam => cam.camera_type !== "device" && cam.camera_type !== "mobile").map(cam => (
                                                            <option key={cam.camera_id} value={cam.camera_id.toString()} className="bg-slate-900 text-white font-normal">
                                                                {cam.location} - {cam.description || "Network Stream"}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                            {cameras.length === 0 && (
                                                <div className="mt-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 p-4 rounded-xl flex flex-col gap-2 text-xs">
                                                    <span className="font-bold flex items-center gap-1.5 text-accent">
                                                        <AlertCircle className="w-4 h-4" /> Setup Live Tracking Instantly!
                                                    </span>
                                                    <p className="text-muted leading-relaxed text-slate-300">
                                                        No pre-registered camera feeds found. You can select either <strong>Device Camera</strong> or <strong>Phone Camera</strong> under the "Create & Integrate New Feed" group to register a tracking stream on-the-fly!
                                                    </p>
                                                </div>
                                            )}
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

            {/* Request Subject Sidebar Drawer */}
            <Portal>
                <AnimatePresence>
                    {isSubjectModalOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsSubjectModalOpen(false)}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                            />

                            {/* Center Modal */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-2xl z-[101] flex flex-col backdrop-blur-2xl rounded-2xl max-h-[90vh]"
                            >
                                <div className="p-6 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--glass-highlight)]">
                                    <h3 className="text-2xl font-bold text-foreground tracking-tight">Request Subject</h3>
                                    <button
                                        onClick={() => setIsSubjectModalOpen(false)}
                                        className="text-muted-bright hover:text-foreground transition-colors bg-[var(--glass-highlight)] p-2 rounded-full"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    <form onSubmit={handleRequestSubject} className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-muted-bright mb-2">Subject Name</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full px-4 py-3 bg-[var(--glass-highlight)] text-foreground rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all placeholder:text-muted"
                                                placeholder="e.g. CS102 - Data Structures"
                                                value={newSubject.subject_name}
                                                onChange={(e) => setNewSubject({ ...newSubject, subject_name: e.target.value })}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-muted-bright mb-2">Description</label>
                                            <textarea
                                                className="w-full h-32 px-4 py-3 bg-[var(--glass-highlight)] text-foreground rounded-xl border border-[var(--glass-border)] focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all placeholder:text-muted resize-none"
                                                placeholder="Provide brief subject overview and requirements..."
                                                value={newSubject.description}
                                                onChange={(e) => setNewSubject({ ...newSubject, description: e.target.value })}
                                            />
                                        </div>

                                        <div className="pt-4 mt-auto">
                                            <button
                                                type="submit"
                                                disabled={requestingSubject || !newSubject.subject_name}
                                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg font-bold py-4 rounded-xl transition-all flex justify-center items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {requestingSubject ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    "Submit Request"
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
                                       {(() => {
                                           const activeCamera = cameras.find(c => c.camera_id === Number(streamingCameraId));
                                           
                                           if (activeCamera?.camera_type === "device") {
                                               return (
                                                   <DeviceCameraStreamer
                                                       cameraId={streamingCameraId!}
                                                       sessionId={streamingSessionId ?? undefined}
                                                       autoStart={true}
                                                       onClose={() => {
                                                           setStreamingCameraId(null);
                                                           setStreamingSessionId(null);
                                                       }}
                                                   />
                                               );
                                           } else if (activeCamera?.camera_type === "mobile") {
                                               return (
                                                   <div className="space-y-6">
                                                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                           {/* Left: Stream preview */}
                                                           <div className="md:col-span-2 space-y-3">
                                                               <div className="w-full aspect-video bg-black rounded-xl overflow-hidden relative shadow-inner ring-1 ring-white/10 min-h-[320px]">
                                                                   <StreamViewer 
                                                                       cameraId={streamingCameraId!} 
                                                                       onClose={() => {
                                                                           setStreamingCameraId(null);
                                                                           setStreamingSessionId(null);
                                                                       }}
                                                                   />
                                                               </div>
                                                               <div className="flex items-center gap-2 text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-lg w-fit">
                                                                   <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping"></span>
                                                                   MOBILE BROADCAST PREVIEW
                                                               </div>
                                                           </div>
                                                           
                                                           {/* Right: Setup instructions with QR code */}
                                                           <div className="bg-slate-900/40 p-5 rounded-xl border border-[var(--glass-border)] flex flex-col justify-between space-y-4">
                                                               <div className="space-y-2">
                                                                   <h4 className="text-sm font-bold text-foreground">Phone Broadcaster Setup</h4>
                                                                   <p className="text-[11px] text-muted-bright leading-relaxed">
                                                                       Scan the QR code below using your mobile device to open the phone broadcaster. This will stream your phone camera live to mark attendance.
                                                                   </p>
                                                               </div>
                                                               
                                                               <div className="flex flex-col items-center gap-3 py-2">
                                                                   <div className="bg-white p-3 rounded-lg shadow-lg ring-4 ring-white/5">
                                                                       <QRCode
                                                                           value={`${hostUrl}/broadcast/${streamingCameraId}`}
                                                                           size={120}
                                                                       />
                                                                   </div>
                                                                   <a
                                                                       href={`${hostUrl}/broadcast/${streamingCameraId}`}
                                                                       target="_blank"
                                                                       className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1 mt-1"
                                                                   >
                                                                       Open Broadcaster Link ↗
                                                                   </a>
                                                               </div>
                                                           </div>
                                                       </div>
                                                   </div>
                                               );
                                           } else {
                                               return (
                                                   <div className="w-full min-h-[400px] flex flex-col items-center justify-center bg-black/40 rounded-xl relative p-4 border border-[var(--glass-border)]">
                                                       <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative shadow-inner ring-1 ring-white/10">
                                                           <StreamViewer 
                                                                cameraId={streamingCameraId!} 
                                                                onClose={() => {
                                                                    setStreamingCameraId(null);
                                                                    setStreamingSessionId(null);
                                                                }}
                                                            />
                                                       </div>
                                                       <p className="text-xs text-muted-bright mt-4 text-center">
                                                           Viewing live physical classroom IP stream for Camera #{streamingCameraId}.
                                                       </p>
                                                   </div>
                                               );
                                           }
                                       })()}
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </Portal>

            {/* Link Camera Sidebar Drawer */}
            <Portal>
                <AnimatePresence>
                    {isLinkingModalOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => {
                                    setIsLinkingModalOpen(false);
                                    setLinkingSessionId(null);
                                }}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                            />

                            {/* Center Modal */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-2xl z-[101] flex flex-col backdrop-blur-2xl rounded-2xl max-h-[90vh]"
                            >
                                <div className="p-6 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--glass-highlight)]">
                                    <h3 className="text-2xl font-bold text-foreground tracking-tight">Integrate Camera</h3>
                                    <button
                                        onClick={() => {
                                            setIsLinkingModalOpen(false);
                                            setLinkingSessionId(null);
                                        }}
                                        className="text-muted-bright hover:text-foreground transition-colors bg-[var(--glass-highlight)] p-2 rounded-full"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    <form onSubmit={handleLinkCamera} className="space-y-6">
                                        {cameras.length === 0 ? (
                                            <div className="text-center py-6 space-y-4">
                                                <VideoOff className="w-12 h-12 text-muted mx-auto opacity-50" />
                                                <div>
                                                    <h4 className="text-sm font-bold text-foreground">No Cameras Registered Yet</h4>
                                                    <p className="text-xs text-muted mt-1 leading-relaxed text-slate-300">
                                                        No camera feeds exist in your organization. You can dynamically create and link a new camera slot instantly below:
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-2.5 pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAutoCreateAndLink("device")}
                                                        className="w-full bg-accent hover:bg-accent-dark text-secondary font-bold text-xs py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(189,244,255,0.25)] text-center cursor-pointer flex items-center justify-center gap-2"
                                                    >
                                                        💻 Integrate & Link New Webcam
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAutoCreateAndLink("mobile")}
                                                        className="w-full bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-bold text-xs py-3.5 rounded-xl transition-all border border-purple-500/30 text-center cursor-pointer flex items-center justify-center gap-2"
                                                    >
                                                        📱 Integrate & Link New Phone Broadcaster
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-sm font-medium text-muted-bright mb-3">Select Active Camera Feed</label>
                                                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                                                        {cameras.map(cam => (
                                                            <label
                                                                key={cam.camera_id}
                                                                className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                                                                    linkingCameraId === cam.camera_id.toString()
                                                                        ? "border-accent bg-accent/10 text-accent shadow-[0_0_15px_-5px_var(--color-accent)]"
                                                                        : "border-[var(--glass-border)] bg-[var(--glass-highlight)] text-muted-bright hover:border-accent/40 hover:text-foreground"
                                                                }`}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name="linking_camera"
                                                                    value={cam.camera_id.toString()}
                                                                    className="mt-1 accent-accent"
                                                                    checked={linkingCameraId === cam.camera_id.toString()}
                                                                    onChange={() => setLinkingCameraId(cam.camera_id.toString())}
                                                                />
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-sm font-bold truncate text-foreground">{cam.location}</span>
                                                                    <span className="text-xs opacity-75 mt-0.5 capitalize truncate">{cam.camera_type} stream {cam.description && `— ${cam.description}`}</span>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="pt-4 border-t border-[var(--glass-border)] flex gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsLinkingModalOpen(false);
                                                            setLinkingSessionId(null);
                                                        }}
                                                        className="flex-1 py-3.5 bg-[var(--glass-highlight)] hover:bg-[var(--glass-border)] text-foreground text-sm font-semibold rounded-xl transition-colors cursor-pointer text-center"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        disabled={linking || !linkingCameraId}
                                                        className="flex-1 bg-gradient-to-r from-accent to-accent-dark hover:from-accent-dark hover:to-accent text-secondary shadow-[0_0_15px_rgba(189,244,255,0.3)] font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                                    >
                                                        {linking ? (
                                                            <>
                                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                                Linking...
                                                            </>
                                                        ) : (
                                                            "Link Camera"
                                                        )}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </form>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </Portal>
        </div>
    );
}

