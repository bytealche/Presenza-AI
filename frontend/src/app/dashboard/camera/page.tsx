"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { getCameras, addCamera, deleteCamera, Camera } from "@/services/cameraService";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { getWsUrl } from "@/utils/config";
import { Monitor, Smartphone, Wifi, Trash2, Plus, Video, VideoOff, RefreshCw } from "lucide-react";

export default function CameraPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [hostUrl, setHostUrl] = useState("");

    useEffect(() => {
        if (user?.role_id === 3) router.push("/dashboard/student");
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
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure?")) return;
        await deleteCamera(id);
        loadCameras();
    };

    const typeIcon = (type: string) => {
        if (type === "mobile") return <Smartphone className="w-4 h-4" />;
        if (type === "device") return <Monitor className="w-4 h-4" />;
        return <Wifi className="w-4 h-4" />;
    };

    const typeBadgeClass = (type: string) => {
        if (type === "mobile") return "bg-purple-500/10 border-purple-500/20 text-purple-300";
        if (type === "device") return "bg-blue-500/10 border-blue-500/20 text-blue-300";
        return "bg-orange-500/10 border-orange-500/20 text-orange-300";
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">Camera Feed Management</h2>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-accent hover:bg-accent/80 text-white px-4 py-2 rounded-md transition-colors shadow-[0_0_15px_-5px_var(--color-accent)]"
                >
                    <Plus className="w-4 h-4" /> Add Camera
                </button>
            </div>

            {loading ? (
                <div className="text-muted flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading cameras...
                </div>
            ) : cameras.length === 0 ? (
                <div className="text-center py-20 text-muted">
                    <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No cameras added yet. Click <strong>+ Add Camera</strong> to get started.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cameras.map((cam) => (
                        <div key={cam.camera_id} className="bg-secondary/30 backdrop-blur-md rounded-lg border border-white/5 overflow-hidden transition-hover hover:border-accent/30">
                            <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                <h3 className="font-semibold text-foreground">{cam.location}</h3>
                                <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${typeBadgeClass(cam.camera_type)}`}>
                                    {typeIcon(cam.camera_type)}
                                    {cam.camera_type.toUpperCase()}
                                </span>
                            </div>

                            <div className="p-4">
                                {/* DEVICE CAMERA */}
                                {cam.camera_type === "device" && (
                                    <DeviceCameraStreamer cameraId={cam.camera_id.toString()} />
                                )}

                                {/* MOBILE CAMERA */}
                                {cam.camera_type === "mobile" && (
                                    <div className="flex flex-col items-center space-y-4">
                                        <div className="w-full text-center space-y-2 pb-2 border-b border-white/10">
                                            <label className="text-sm text-gray-200 font-medium block">Server URL for Mobile</label>
                                            <input
                                                className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-center text-white w-full focus:border-accent outline-none"
                                                value={hostUrl}
                                                onChange={(e) => setHostUrl(e.target.value)}
                                                placeholder="https://your-frontend.vercel.app"
                                            />
                                        </div>
                                        <div className="w-full aspect-video bg-black rounded relative overflow-hidden ring-1 ring-white/10">
                                            <StreamViewer cameraId={cam.camera_id.toString()} />
                                        </div>
                                        <div className="text-center space-y-2">
                                            <p className="text-sm text-gray-200 font-medium">Scan to Stream from Phone</p>
                                            <div className="bg-white p-2 inline-block border rounded">
                                                <QRCode
                                                    value={`${hostUrl.startsWith("http") ? hostUrl : "http://" + hostUrl}/broadcast/${cam.camera_id}`}
                                                    size={100}
                                                />
                                            </div>
                                            <a
                                                href={`${hostUrl.startsWith("http") ? hostUrl : "http://" + hostUrl}/broadcast/${cam.camera_id}`}
                                                target="_blank"
                                                className="block text-sm text-accent hover:underline mt-1"
                                            >
                                                Open Broadcast Link ↗
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* IP CAMERA */}
                                {cam.camera_type === "ip" && (
                                    <div className="space-y-2">
                                        <div className="w-full aspect-video bg-black rounded relative overflow-hidden ring-1 ring-white/10">
                                            <StreamViewer cameraId={cam.camera_id.toString()} />
                                        </div>
                                        <p className="text-xs text-muted truncate">URL: {cam.connection_url}</p>
                                    </div>
                                )}

                                {(user?.role_id === 1 || user?.role_id === 2) && (
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            onClick={() => handleDelete(cam.camera_id)}
                                            className="flex items-center gap-1 text-red-400 text-sm hover:text-red-300 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Camera Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-secondary p-6 rounded-xl w-full max-w-md border border-white/10 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 text-foreground">Add Camera Source</h3>

                        {/* Camera Type Selector */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {[
                                { value: "device", label: "Device Camera", icon: Monitor, desc: "Use this device's webcam" },
                                { value: "mobile", label: "Mobile Phone", icon: Smartphone, desc: "Stream via QR scan" },
                                { value: "ip", label: "IP Camera", icon: Wifi, desc: "RTSP / HTTP stream" },
                            ].map(({ value, label, icon: Icon, desc }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setNewCam({ ...newCam, camera_type: value })}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border text-center transition-all ${newCam.camera_type === value
                                        ? "border-accent bg-accent/10 text-accent"
                                        : "border-white/10 bg-white/5 text-muted hover:border-white/20"}`}
                                >
                                    <Icon className="w-6 h-6" />
                                    <span className="text-xs font-medium">{label}</span>
                                    <span className="text-[10px] opacity-70">{desc}</span>
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleAdd} className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-muted mb-1">Location Name</label>
                                <input
                                    className="w-full bg-background border border-white/10 p-2 rounded text-foreground focus:border-accent outline-none"
                                    value={newCam.location}
                                    onChange={e => setNewCam({ ...newCam, location: e.target.value })}
                                    placeholder="e.g. Classroom A"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted mb-1">Description (optional)</label>
                                <input
                                    className="w-full bg-background border border-white/10 p-2 rounded text-foreground focus:border-accent outline-none"
                                    value={newCam.description}
                                    onChange={e => setNewCam({ ...newCam, description: e.target.value })}
                                    placeholder="e.g. Front-facing camera"
                                />
                            </div>
                            {newCam.camera_type === "ip" && (
                                <div>
                                    <label className="block text-sm font-medium text-muted mb-1">Stream URL</label>
                                    <input
                                        className="w-full bg-background border border-white/10 p-2 rounded text-foreground focus:border-accent outline-none"
                                        value={newCam.connection_url}
                                        onChange={e => setNewCam({ ...newCam, connection_url: e.target.value })}
                                        placeholder="rtsp:// or http://..."
                                    />
                                </div>
                            )}
                            <div className="flex justify-end space-x-2 pt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-foreground rounded transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded shadow-lg shadow-accent/20">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Device Camera Streamer ─────────────────────────────────────────────────
// Streams from the user's own webcam directly to the backend via WebSocket
function DeviceCameraStreamer({ cameraId }: { cameraId: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [isStreaming, setIsStreaming] = useState(false);
    const [status, setStatus] = useState("Ready");
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>("");
    const [aiData, setAiData] = useState<any[]>([]);
    const imgRef = useRef<HTMLImageElement>(null);

    // Load available video devices
    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(devs => {
            const videoDevs = devs.filter(d => d.kind === "videoinput");
            setDevices(videoDevs);
            if (videoDevs.length > 0) setSelectedDevice(videoDevs[0].deviceId);
        }).catch(console.error);

        return () => stopStreaming();
    }, []);

    const startStreaming = useCallback(async () => {
        try {
            setStatus("Requesting camera...");
            const constraints: MediaStreamConstraints = {
                video: selectedDevice ? { deviceId: { exact: selectedDevice }, width: 640, height: 480 } : { width: 640, height: 480 },
                audio: false
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            // Connect WebSocket as sender
            const wsUrl = getWsUrl(`/ws/stream/${cameraId}?client_type=sender`);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setStatus("Streaming");
                setIsStreaming(true);

                // Send frames at 15fps
                intervalRef.current = setInterval(() => {
                    if (ws.readyState !== WebSocket.OPEN) return;
                    const canvas = canvasRef.current;
                    const video = videoRef.current;
                    if (!canvas || !video || video.videoWidth === 0) return;
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;
                    ctx.drawImage(video, 0, 0);
                    canvas.toBlob(blob => {
                        if (blob && ws.readyState === WebSocket.OPEN) ws.send(blob);
                    }, "image/jpeg", 0.7);
                }, 1000 / 15);
            };

            ws.onmessage = (event) => {
                if (typeof event.data === "string") {
                    try {
                        const parsed = JSON.parse(event.data);
                        if (parsed.type === "ai_analysis") setAiData(parsed.data);
                    } catch { }
                } else if (imgRef.current) {
                    const oldUrl = imgRef.current.src;
                    if (oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
                    imgRef.current.src = URL.createObjectURL(event.data);
                }
            };

            ws.onerror = () => setStatus("WebSocket error");
            ws.onclose = () => { setStatus("Disconnected"); setIsStreaming(false); };
        } catch (err: any) {
            setStatus(`Error: ${err.message}`);
        }
    }, [cameraId, selectedDevice]);

    const stopStreaming = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (wsRef.current) wsRef.current.close();
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsStreaming(false);
        setStatus("Stopped");
    }, []);

    return (
        <div className="space-y-3">
            {/* Camera device selector */}
            {devices.length > 1 && (
                <select
                    className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-accent outline-none"
                    value={selectedDevice}
                    onChange={e => {
                        setSelectedDevice(e.target.value);
                        if (isStreaming) { stopStreaming(); }
                    }}
                    disabled={isStreaming}
                >
                    {devices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${devices.indexOf(d) + 1}`}</option>
                    ))}
                </select>
            )}

            {/* Live preview */}
            <div className="relative w-full aspect-video bg-black rounded overflow-hidden ring-1 ring-white/10">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                <canvas ref={canvasRef} className="hidden" />

                {/* AI overlays */}
                {aiData.map((data, idx) => {
                    if (!data.bbox) return null;
                    const [x, y, w, h] = data.bbox;
                    return (
                        <div key={idx}
                            className={`absolute border-2 ${data.is_fraud ? "border-red-500" : "border-green-500"} flex flex-col items-end justify-end`}
                            style={{ left: `${(x / 640) * 100}%`, top: `${(y / 480) * 100}%`, width: `${(w / 640) * 100}%`, height: `${(h / 480) * 100}%`, pointerEvents: "none" }}>
                            <span className="bg-black/70 text-white text-[9px] px-1 py-0.5 rounded-sm">
                                {data.user_id || "Unknown"} {data.engagement_score ? `(${Math.round(data.engagement_score * 100)}%)` : ""}
                            </span>
                        </div>
                    );
                })}

                {/* Status badge */}
                <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded text-xs ${isStreaming ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-black/50 text-muted"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                    {status}
                </div>
            </div>

            {/* Controls */}
            <button
                onClick={isStreaming ? stopStreaming : startStreaming}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${isStreaming
                    ? "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
                    : "bg-accent/20 border border-accent/30 text-accent hover:bg-accent/30"}`}
            >
                {isStreaming ? <><VideoOff className="w-4 h-4" /> Stop Streaming</> : <><Video className="w-4 h-4" /> Start Streaming</>}
            </button>
        </div>
    );
}

// ─── Stream Viewer ──────────────────────────────────────────────────────────
function StreamViewer({ cameraId }: { cameraId: string }) {
    const imgRef = useRef<HTMLImageElement>(null);
    const [aiData, setAiData] = useState<any[]>([]);

    useEffect(() => {
        const wsUrl = getWsUrl(`/ws/stream/${cameraId}?client_type=receiver`);
        let ws: WebSocket;
        const connect = () => {
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                if (typeof event.data === "string") {
                    try {
                        const parsed = JSON.parse(event.data);
                        if (parsed.type === "ai_analysis") setAiData(parsed.data);
                    } catch { }
                } else if (imgRef.current) {
                    const oldUrl = imgRef.current.src;
                    if (oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
                    imgRef.current.src = URL.createObjectURL(event.data);
                }
            };
            ws.onopen = () => console.log("Viewer Connected");
            ws.onerror = (e) => console.error("Viewer Error", e);
            ws.onclose = () => setTimeout(connect, 3000);
        };
        connect();
        return () => ws?.close();
    }, [cameraId]);

    return (
        <div className="relative w-full h-full">
            <img ref={imgRef} className="w-full h-full object-cover" alt="Live Stream"
                onError={(e) => e.currentTarget.style.display = "none"}
                onLoad={(e) => e.currentTarget.style.display = "block"} />
            {aiData.map((data, idx) => {
                if (!data.bbox) return null;
                const [x, y, w, h] = data.bbox;
                return (
                    <div key={idx}
                        className={`absolute border-2 ${data.is_fraud ? "border-red-500" : "border-green-500"}`}
                        style={{ left: `${(x / 640) * 100}%`, top: `${(y / 480) * 100}%`, width: `${(w / 640) * 100}%`, height: `${(h / 480) * 100}%`, pointerEvents: "none" }}>
                        <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 rounded-sm">
                            {data.user_id || "Unknown"}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
