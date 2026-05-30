"use client";

import React, { useEffect, useState } from "react";
import { getCameras, addCamera, deleteCamera, Camera } from "@/services/cameraService";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { 
    Monitor, Smartphone, Wifi, Trash2, Plus, Video, VideoOff, 
    RefreshCw, ChevronDown, PlusCircle, AlertCircle, Loader2
} from "lucide-react";
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

export default function CameraPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [hostUrl, setHostUrl] = useState("");
    const [expandedCams, setExpandedCams] = useState<Record<number, boolean>>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            if (user.role_id === 2) {
                router.push("/dashboard/teacher");
            } else if (user.role_id === 3) {
                router.push("/dashboard/student");
            }
        }
    }, [user, router]);

    useEffect(() => {
        if (typeof window !== "undefined") setHostUrl(window.location.origin);
        loadCameras();
    }, [user]);

    const [newCam, setNewCam] = useState({
        location: "",
        connection_url: "",
        description: "",
        camera_type: "device"
    });

    const loadCameras = async () => {
        try {
            const data = await getCameras();
            setCameras(data);
        } catch (error) {
            console.error("Failed to load cameras", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            await addCamera({
                camera_type: newCam.camera_type,
                location: newCam.location,
                connection_url: newCam.camera_type === "ip" ? newCam.connection_url : "Device stream",
                description: newCam.description
            });
            setShowModal(false);
            setNewCam({ location: "", connection_url: "", description: "", camera_type: "device" });
            loadCameras();
        } catch (error: any) {
            const msg = error.response?.data?.detail || "Failed to add camera";
            alert(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this camera?")) return;
        try {
            await deleteCamera(id);
            loadCameras();
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.detail || "Delete failed! This camera might be linked to an active class session.";
            alert(msg);
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedCams(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const typeIcon = (type: string) => {
        if (type === "mobile") return <Smartphone className="w-3.5 h-3.5" />;
        if (type === "device") return <Monitor className="w-3.5 h-3.5" />;
        return <Wifi className="w-3.5 h-3.5" />;
    };

    const typeBadgeClass = (type: string) => {
        if (type === "mobile") return "bg-purple-500/15 border-purple-500/30 text-purple-400";
        if (type === "device") return "bg-blue-500/15 border-blue-500/30 text-blue-400";
        return "bg-orange-500/15 border-orange-500/30 text-orange-400";
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 md:px-0 pb-12">
            
            {/* ── HEADER ──────────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--glass-border)] pb-6">
                <div>
                    <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent via-foreground to-violet drop-shadow-md tracking-tight">
                        Camera Feed Management
                    </h2>
                    <p className="text-muted text-sm mt-1">
                        Register, allocate, and monitor active camera capture streams for smart attendance.
                    </p>
                </div>
                
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all shadow-[0_0_20px_-5px_var(--color-accent)] cursor-pointer"
                >
                    <PlusCircle className="w-4 h-4" /> Add Camera Slot
                </button>
            </div>

            {/* ── LOAD STATE OR EMPTY SLOT ────────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center gap-3 text-muted bg-[var(--glass-bg)] border border-[var(--glass-border)] px-6 py-4.5 rounded-2xl w-fit">
                    <RefreshCw className="w-4 h-4 animate-spin text-accent" />
                    <span className="text-sm font-semibold tracking-wide">Retrieving camera indexes...</span>
                </div>
            ) : cameras.length === 0 ? (
                <div className="glass-card text-center py-20 border border-dashed border-[var(--glass-border)] rounded-2xl">
                    <VideoOff className="w-16 h-16 mx-auto mb-4 text-muted opacity-45" />
                    <h3 className="text-lg font-bold text-foreground mb-1">No Active Feeds Connected</h3>
                    <p className="text-muted text-sm max-w-md mx-auto px-6">
                        No video slots configured yet. Connect a local webcam, configure an IP stream, or scan the QR code to use your phone's camera.
                    </p>
                    <button 
                        onClick={() => setShowModal(true)} 
                        className="mt-6 text-xs font-bold text-accent bg-accent/15 border border-accent/30 px-5 py-2.5 rounded-xl hover:bg-accent/25 transition-all inline-flex items-center gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" /> Initialize First Camera
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cameras.map((cam) => (
                        <div 
                            key={cam.camera_id} 
                            className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] overflow-hidden transition-all duration-300 hover:border-accent/40 shadow-xl group hover:shadow-2xl hover:-translate-y-0.5 flex flex-col justify-between"
                        >
                            
                            {/* Card Header (Delete Button relocated here) */}
                            <div className="px-5 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-highlight)] flex justify-between items-center gap-2">
                                <div className="flex flex-col min-w-0">
                                    <h3 className="font-extrabold text-foreground text-sm truncate" title={cam.location}>
                                        {cam.location}
                                    </h3>
                                    {cam.description && (
                                        <p className="text-[10px] text-muted truncate mt-0.5 font-medium">
                                            {cam.description}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-lg border tracking-wide uppercase ${typeBadgeClass(cam.camera_type)}`}>
                                        {typeIcon(cam.camera_type)}
                                        {cam.camera_type}
                                    </span>
                                    
                                    {(user?.role_id === 1 || user?.role_id === 2) && (
                                        <button
                                            onClick={() => handleDelete(cam.camera_id)}
                                            className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                                            title="Delete camera feed"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Card Content */}
                            <div className="p-5 flex-grow space-y-4">
                                
                                {/* 1. DEVICE CAMERA SLOT */}
                                {cam.camera_type === "device" && (
                                    <div className="space-y-3">
                                        <div className="w-full aspect-video bg-black rounded-xl relative overflow-hidden ring-1 ring-[var(--glass-border)] shadow-inner">
                                            <DeviceCameraStreamer cameraId={cam.camera_id.toString()} />
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg w-fit">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                            READY: HOST WEB CAM
                                        </div>
                                    </div>
                                )}

                                {/* 2. IP CAMERA SLOT */}
                                {cam.camera_type === "ip" && (
                                    <div className="space-y-3">
                                        <div className="w-full aspect-video bg-black rounded-xl relative overflow-hidden ring-1 ring-[var(--glass-border)] shadow-inner">
                                            <StreamViewer cameraId={cam.camera_id.toString()} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                                IP ACTIVE
                                            </span>
                                            <p className="text-[10px] text-muted truncate min-w-0 font-mono" title={cam.connection_url}>
                                                URL: {cam.connection_url}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* 3. MOBILE CAMERA SLOT (Uncluttered & Collapsible Setup) */}
                                {cam.camera_type === "mobile" && (
                                    <div className="space-y-3.5">
                                        <div className="w-full aspect-video bg-black rounded-xl relative overflow-hidden ring-1 ring-[var(--glass-border)] shadow-inner">
                                            <StreamViewer cameraId={cam.camera_id.toString()} />
                                        </div>
                                        
                                        {/* Mobile Broadcaster setup panel */}
                                        <div className="border border-[var(--glass-border)] rounded-xl overflow-hidden bg-slate-900/25">
                                            <button
                                                type="button"
                                                onClick={() => toggleExpand(cam.camera_id)}
                                                className="w-full flex justify-between items-center px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-[var(--glass-highlight)] transition-colors outline-none cursor-pointer"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Smartphone className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                                                    Broadcast Connection Setup
                                                </span>
                                                <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform duration-300 ${expandedCams[cam.camera_id] ? "rotate-180" : ""}`} />
                                            </button>

                                            {expandedCams[cam.camera_id] && (
                                                <div className="p-4 border-t border-[var(--glass-border)] space-y-4 bg-slate-950/45 animate-in fade-in slide-in-from-top-1.5 duration-200">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-muted font-extrabold uppercase tracking-wider block">Server Host Address</label>
                                                        <input
                                                            className="bg-slate-900 border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-xs text-foreground w-full focus:border-accent outline-none font-medium"
                                                            value={hostUrl}
                                                            onChange={(e) => setHostUrl(e.target.value)}
                                                            placeholder="https://your-frontend.vercel.app"
                                                        />
                                                    </div>
                                                    
                                                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/60 p-3 rounded-xl border border-[var(--glass-border)]">
                                                        <div className="bg-white p-2.5 rounded-lg shrink-0 shadow-lg ring-4 ring-white/5">
                                                            <QRCode
                                                                value={`${hostUrl.startsWith("http") ? hostUrl : "http://" + hostUrl}/broadcast/${cam.camera_id}`}
                                                                size={90}
                                                            />
                                                        </div>
                                                        <div className="space-y-1 text-center sm:text-left min-w-0">
                                                            <p className="text-xs font-bold text-foreground">Scan to stream</p>
                                                            <p className="text-[10px] text-muted leading-relaxed">Cast your mobile camera live using standard broadcast protocols.</p>
                                                            <a
                                                                href={`${hostUrl.startsWith("http") ? hostUrl : "http://" + hostUrl}/broadcast/${cam.camera_id}`}
                                                                target="_blank"
                                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-accent hover:underline mt-1.5"
                                                            >
                                                                Open Web Link ↗
                                                            </a>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── ADD CAMERA MODAL ────────────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[var(--glass-bg)] p-6 rounded-2xl w-full max-w-lg border border-[var(--glass-border)] shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="mb-5">
                            <h3 className="text-lg font-bold text-foreground">Add Camera Source</h3>
                            <p className="text-muted text-xs mt-1">Configure a webcam stream, smartphone broadcaster, or dedicated IP camera.</p>
                        </div>

                        {/* Camera Type Selector */}
                        <div className="grid grid-cols-3 gap-3 mb-5">
                            {[
                                { value: "device", label: "Webcam", icon: Monitor, desc: "Direct browser cam" },
                                { value: "mobile", label: "Mobile Stream", icon: Smartphone, desc: "Cast via QR scan" },
                                { value: "ip", label: "IP Source", icon: Wifi, desc: "Network stream URL" },
                            ].map(({ value, label, icon: Icon, desc }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setNewCam({ ...newCam, camera_type: value })}
                                    className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center transition-all cursor-pointer ${newCam.camera_type === value
                                        ? "border-accent bg-accent/10 text-accent shadow-[0_0_15px_-5px_var(--color-accent)]"
                                        : "border-[var(--glass-border)] bg-[var(--glass-highlight)] text-muted hover:border-accent/40"}`}
                                >
                                    <Icon className="w-5 h-5 shrink-0" />
                                    <span className="text-xs font-bold">{label}</span>
                                    <span className="text-[9px] opacity-60 font-medium leading-tight">{desc}</span>
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleAdd} className="space-y-4">
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-muted uppercase tracking-wider">Location / Slot Name</label>
                                <input
                                    className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] p-3 rounded-xl text-foreground focus:border-accent outline-none font-medium text-sm transition-all"
                                    value={newCam.location}
                                    onChange={e => setNewCam({ ...newCam, location: e.target.value })}
                                    placeholder="e.g. Auditorium A, Classroom B"
                                    required
                                />
                            </div>
                            
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-muted uppercase tracking-wider">Description (optional)</label>
                                <input
                                    className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] p-3 rounded-xl text-foreground focus:border-accent outline-none font-medium text-sm transition-all"
                                    value={newCam.description}
                                    onChange={e => setNewCam({ ...newCam, description: e.target.value })}
                                    placeholder="e.g. Rear ceiling mounting angle"
                                />
                            </div>
                            
                            {newCam.camera_type === "ip" && (
                                <div className="space-y-1 animate-in slide-in-from-top-1.5 duration-200">
                                    <label className="block text-xs font-bold text-muted uppercase tracking-wider">Stream Connection URL</label>
                                    <input
                                        className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] p-3 rounded-xl text-foreground focus:border-accent outline-none font-mono text-xs transition-all"
                                        value={newCam.connection_url}
                                        onChange={e => setNewCam({ ...newCam, connection_url: e.target.value })}
                                        placeholder="rtsp://admin:pass@192.168.1.50:554/live"
                                        required
                                    />
                                    <span className="text-[10px] text-muted font-medium flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Supports RTSP, HTTP, and RTMP protocol links.</span>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--glass-border)] mt-6">
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)} 
                                    className="px-5 py-2.5 bg-[var(--glass-highlight)] hover:bg-[var(--glass-border)] text-foreground text-sm font-semibold rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="px-5 py-2.5 bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 text-white text-sm font-semibold rounded-xl shadow-lg shadow-accent/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        "Create Camera Slot"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
