"use client";

import React, { useEffect, useState, useRef } from "react";
import { getCameras, addCamera, deleteCamera, Camera } from "@/services/cameraService";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { getWsUrl } from "@/utils/config";

export default function CameraPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (user?.role_id === 3) {
            router.push("/dashboard/student");
        }
    }, [user, router]);

    // Host IP for QR Code (default to window.location if available, else localhost)
    const [hostUrl, setHostUrl] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            // Default to window.location.origin but users likely need to change it from 'localhost'
            setHostUrl(window.location.origin);
        }



        loadCameras();
    }, [user]); // Add user dependency

    // Form State
    const [newCam, setNewCam] = useState({
        location: "",
        connection_url: "",
        description: "",
        camera_type: "mobile" // Default to Mobile since that's the cool feature
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
            if (!user?.org_id) {
                alert("Organization ID missing. Please relogin.");
                return;
            }

            // For mobile, we generate a dummy URL initially, or just use ID
            const isMobile = newCam.camera_type === "mobile";

            await addCamera({
                org_id: user.org_id,
                camera_type: newCam.camera_type,
                location: newCam.location,
                connection_url: isMobile ? "Generated on Save" : newCam.connection_url,
                description: newCam.description
            });
            setShowModal(false);
            setNewCam({ location: "", connection_url: "", description: "", camera_type: "mobile" });
            loadCameras();
        } catch (error: any) {
            console.error("Failed to add camera", error);
            const msg = error.response?.data?.detail || "Failed to add camera";
            alert(msg);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure?")) return;
        await deleteCamera(id);
        loadCameras();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-foreground">Camera Feed Management</h2>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-accent hover:bg-accent/80 text-white px-4 py-2 rounded-md transition-colors shadow-[0_0_15px_-5px_var(--color-accent)]"
                >
                    + Add Camera
                </button>
            </div>

            {loading ? <div className="text-muted">Loading...</div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cameras.map((cam) => (
                        <div key={cam.camera_id} className="bg-secondary/30 backdrop-blur-md rounded-lg border border-white/5 overflow-hidden transition-hover hover:border-accent/30">
                            <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                <h3 className="font-semibold text-foreground">{cam.location}</h3>
                                <span className={`text-xs px-2 py-1 rounded border ${cam.camera_type === 'mobile' ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300'}`}>
                                    {cam.camera_type.toUpperCase()}
                                </span>
                            </div>

                            <div className="p-4">
                                {cam.camera_type === 'mobile' ? (
                                    <div className="flex flex-col items-center space-y-4">
                                        {/* IP Configuration (for this specific car or global?) - Actually global makes more sense for "Server IP" */}
                                        <div className="w-full text-center space-y-2 pb-2 border-b border-white/10">
                                            <label className="text-sm text-gray-200 font-medium block">Server IP Address (for Mobile Connection)</label>
                                            <input
                                                className="bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-center text-white w-32 focus:border-accent outline-none"
                                                value={hostUrl}
                                                onChange={(e) => setHostUrl(e.target.value)}
                                                placeholder="192.168.x.x:3000"
                                            />
                                            <p className="text-xs text-gray-300 mt-1">
                                                Enter your PC's Local IP (run `ipconfig` or check settings).
                                                <br />Ensure port (e.g. :3000) is included if needed.
                                            </p>
                                        </div>

                                        {/* Viewer */}
                                        <div className="w-full aspect-video bg-black rounded relative overflow-hidden ring-1 ring-white/10">
                                            <StreamViewer cameraId={cam.camera_id.toString()} />
                                        </div>

                                        {/* QR Code Section */}
                                        <div className="text-center space-y-2">
                                            <p className="text-sm text-gray-200 font-medium">Scan to Stream from Phone</p>

                                            <div className="bg-white p-2 inline-block border rounded">
                                                <QRCode
                                                    value={`${hostUrl.startsWith('http') ? hostUrl : 'http://' + hostUrl}/broadcast/${cam.camera_id}`}
                                                    size={100}
                                                />
                                            </div>
                                            <a
                                                href={`${hostUrl.startsWith('http') ? hostUrl : 'http://' + hostUrl}/broadcast/${cam.camera_id}`}
                                                target="_blank"
                                                className="block text-sm text-accent hover:underline decoration-accent font-medium mt-2"
                                            >
                                                Open Broadcaster Link
                                            </a>
                                        </div>
                                    </div>
                                ) : (
                                    // IP Camera Viewer (Basic Image Refresh or Link)
                                    <div className="space-y-2">
                                        <div className="aspect-video bg-black/50 flex items-center justify-center text-muted">
                                            IP Stream Preview
                                        </div>
                                        <p className="text-sm truncate text-muted">URL: {cam.connection_url}</p>
                                    </div>
                                )}

                                {/* Delete Button (Admin & Faculty Only) */}
                                {(user?.role_id === 1 || user?.role_id === 2) && (
                                    <div className="mt-4 flex justify-end">
                                        <button onClick={() => handleDelete(cam.camera_id)} className="text-red-400 text-sm hover:text-red-300">Delete</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-secondary p-6 rounded-lg w-full max-w-md border border-white/10 shadow-2xl">
                        <h3 className="text-lg font-bold mb-4 text-foreground">Add Camera</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-muted">Type</label>
                                <select
                                    className="w-full bg-background border border-white/10 p-2 rounded text-foreground focus:border-accent outline-none"
                                    value={newCam.camera_type}
                                    onChange={e => setNewCam({ ...newCam, camera_type: e.target.value })}
                                >
                                    <option value="mobile">Mobile Phone (QR Code)</option>
                                    <option value="ip">IP Camera (RTSP/HTTP)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted">Location Name</label>
                                <input
                                    className="w-full bg-background border border-white/10 p-2 rounded text-foreground focus:border-accent outline-none"
                                    value={newCam.location}
                                    onChange={e => setNewCam({ ...newCam, location: e.target.value })}
                                    placeholder="e.g. Front Gate"
                                    required
                                />
                            </div>

                            {newCam.camera_type === 'ip' && (
                                <div>
                                    <label className="block text-sm font-medium text-muted">Stream URL</label>
                                    <input
                                        className="w-full bg-background border border-white/10 p-2 rounded text-foreground focus:border-accent outline-none"
                                        value={newCam.connection_url}
                                        onChange={e => setNewCam({ ...newCam, connection_url: e.target.value })}
                                        placeholder="http://..."
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

// Sub-component for viewing the stream
function StreamViewer({ cameraId }: { cameraId: string }) {
    const imgRef = useRef<HTMLImageElement>(null);
    const [aiData, setAiData] = useState<any[]>([]);

    useEffect(() => {
        // Use dynamic WS URL from config
        const wsUrl = getWsUrl(`/ws/stream/${cameraId}?client_type=receiver`);

        let ws: WebSocket;

        const connect = () => {
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                const message = event.data;

                // Check if it's a JSON string (AI Data)
                if (typeof message === "string") {
                    try {
                        const parsed = JSON.parse(message);
                        if (parsed.type === "ai_analysis") {
                            setAiData(parsed.data);
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
                // Otherwise assume it's a blob (Video Frame)
                else {
                    if (imgRef.current) {
                        const blob = message;
                        // Revoke old URL to prevent memory leak
                        const oldUrl = imgRef.current.src;
                        if (oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);

                        imgRef.current.src = URL.createObjectURL(blob);
                    }
                }
            };
            ws.onopen = () => console.log("Viewer Connected");
            ws.onerror = (e) => console.error("Viewer Error", e);
            ws.onclose = () => setTimeout(connect, 3000); // Auto reconnect
        };
        connect();

        return () => ws?.close();
    }, [cameraId]);

    return (
        <div className="relative w-full h-full">
            <img
                ref={imgRef}
                className="w-full h-full object-cover"
                alt="Live Stream"
                src="/placeholder-camera.png" // Use a placeholder initially
                onError={(e) => e.currentTarget.style.display = 'none'}
                onLoad={(e) => e.currentTarget.style.display = 'block'}
            />

            {/* AI Overlays */}
            {aiData.map((data, idx) => {
                const RX = 640;
                const RY = 480;

                if (!data.bbox) return null;

                const [x, y, w, h] = data.bbox;
                const left = (x / RX) * 100;
                const top = (y / RY) * 100;
                const width = (w / RX) * 100;
                const height = (h / RY) * 100;

                const color = data.is_fraud ? "border-red-500" : "border-green-500";
                const label = data.user_id ? `${data.user_id} (${Math.round(data.engagement_score * 100)}%)` : "Unknown";

                return (
                    <div
                        key={idx}
                        className={`absolute border-2 ${color} flex flex-col items-center justify-end shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                        style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                            pointerEvents: 'none'
                        }}
                    >
                        <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                            {label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
