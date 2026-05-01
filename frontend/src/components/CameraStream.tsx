"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Video, VideoOff } from "lucide-react";
import { getWsUrl } from "@/utils/config";

// Streams from the user's own webcam directly to the backend via WebSocket
export function DeviceCameraStreamer({ cameraId, sessionId }: { cameraId: string; sessionId?: number }) {
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
    const [timing, setTiming] = useState<{ decode_ms: number; ai_ms: number; db_ms: number; total_ms: number } | null>(null);
    const [confirmedUsers, setConfirmedUsers] = useState<(number | string)[]>([]);
    const [totalSaved, setTotalSaved] = useState(0);
    const [facesList, setFacesList] = useState<Array<{
        user_id: number | null;
        name: string;
        status: "provisional" | "confirmed" | "fraud" | "unknown";
        confidence: number;
        is_fraud?: boolean;
    }>>([]);
    const [unknownCount, setUnknownCount] = useState(0);
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

            // Connect WebSocket as sender, including session_id if provided
            const sessionParam = sessionId != null ? `&session_id=${sessionId}` : "";
            const wsUrl = getWsUrl(`/ws/stream/${cameraId}?client_type=sender${sessionParam}`);
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
                    if (event.data === "__ping__") {
                        // Respond to server heartbeat to keep connection alive
                        ws.send("__pong__");
                        return;
                    }
                    try {
                        const parsed = JSON.parse(event.data);
                        if (parsed.type === "ai_analysis") {
                            setAiData(parsed.data ?? []);
                            if (parsed.faces) setFacesList(parsed.faces);
                            if (typeof parsed.unknown_count === "number") setUnknownCount(parsed.unknown_count);
                            if (parsed.timing) setTiming(parsed.timing);
                            if (parsed.attendance) {
                                if (parsed.attendance.confirmed_users?.length) {
                                    setConfirmedUsers(prev => {
                                        const existing = new Set(prev.map(String));
                                        const incoming = (parsed.attendance.confirmed_users as (number|string)[]).filter(
                                            u => !existing.has(String(u))
                                        );
                                        return incoming.length ? [...prev, ...incoming] : prev;
                                    });
                                }
                                if (parsed.attendance.saved > 0) {
                                    setTotalSaved(prev => prev + parsed.attendance.saved);
                                }
                            }
                        }
                    } catch { }
                } else if (imgRef.current) {
                    const oldUrl = imgRef.current.src;
                    if (oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
                    imgRef.current.src = URL.createObjectURL(event.data);
                }
            };

            ws.onerror = () => setStatus("WebSocket error");
            ws.onclose = () => {
                setStatus("Disconnected");
                setIsStreaming(false);
                // Auto-reconnect after 3s if streaming was active
                setTimeout(() => {
                    if (isStreaming) startStreaming();
                }, 3000);
            };
        } catch (err: any) {
            setStatus(`Error: ${err.message}`);
        }
    }, [cameraId, selectedDevice, isStreaming]);

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

            {/* Two-column layout: video left, sidebar right */}
            <div className={`flex gap-3 flex-col ${isStreaming ? "md:flex-row" : ""}`}>
                {/* Live preview */}
                <div className="relative flex-1 aspect-video md:aspect-auto md:min-h-[480px] md:max-h-[70vh] bg-black rounded overflow-hidden ring-1 ring-white/10 min-w-0">
                    <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* AI bounding box overlays */}
                    {aiData.map((data, idx) => {
                        if (!data.bbox) return null;
                        const [x, y, w, h] = data.bbox;
                        const borderColor = data.is_fraud
                            ? "border-red-500"
                            : data.user_id
                            ? (data.confirmed ? "border-green-400" : "border-yellow-400")
                            : "border-gray-400";
                        return (
                            <div key={idx}
                                className={`absolute border-2 ${borderColor} flex flex-col items-end justify-end`}
                                style={{ left: `${(x / 640) * 100}%`, top: `${(y / 480) * 100}%`, width: `${(w / 640) * 100}%`, height: `${(h / 480) * 100}%`, pointerEvents: "none" }}>
                                <span className="bg-black/80 text-white text-[9px] px-1 py-0.5 rounded-sm leading-tight">
                                    {data.user_id ? (data.confirmed ? "✓" : "~") : "?"} {data.user_id || "Unknown"}
                                </span>
                            </div>
                        );
                    })}

                    {/* Status badge */}
                    <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded text-xs ${isStreaming ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-black/50 text-white"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                        {status}
                    </div>

                    {/* Real-time latency badge */}
                    {timing && isStreaming && (
                        <div className="absolute bottom-2 left-2 bg-black/70 text-[10px] text-white/80 px-2 py-1 rounded font-mono flex gap-2">
                            <span title="AI inference time" className="text-accent">AI {timing.ai_ms}ms</span>
                            <span title="Database write time" className="text-violet">DB {timing.db_ms}ms</span>
                            <span title="Total frame processing time" className="text-white/40">∑{timing.total_ms}ms</span>
                        </div>
                    )}
                </div>

                {/* Faces sidebar — only visible while streaming */}
                {isStreaming && (
                    <div className="w-full md:w-64 shrink-0 flex flex-col bg-black/30 border border-white/10 rounded-lg overflow-hidden md:max-h-[480px]">
                        {/* Sidebar header */}
                        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-black/20">
                            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">In Frame</span>
                            <div className="flex gap-1.5 items-center">
                                <span className="text-[10px] text-green-400 font-medium">{facesList.filter(f => f.status !== "unknown").length} known</span>
                                {unknownCount > 0 && (
                                    <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                                        {unknownCount} unk
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Face rows */}
                        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                            {facesList.length === 0 && (
                                <p className="text-center text-white/30 text-xs py-6 italic">No faces detected</p>
                            )}
                            {facesList.map((face, i) => {
                                const statusConfig = {
                                    confirmed: { label: "Confirmed", cls: "bg-green-500/20 text-green-400 border-green-500/30" },
                                    provisional: { label: "Partial", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                                    fraud: { label: "Fraud", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
                                    unknown: { label: "Unknown", cls: "bg-white/10 text-white/40 border-white/10" },
                                }[face.status] ?? { label: face.status, cls: "bg-white/10 text-white/40 border-white/10" };

                                return (
                                    <div key={i} className="flex items-center gap-2 px-3 py-2">
                                        {/* Avatar initials */}
                                        <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                                            face.status === "confirmed" ? "bg-green-500/20 border-green-400/40 text-green-300"
                                            : face.status === "provisional" ? "bg-yellow-500/20 border-yellow-400/40 text-yellow-300"
                                            : face.status === "fraud" ? "bg-red-500/20 border-red-400/40 text-red-300"
                                            : "bg-white/10 border-white/10 text-white/30"
                                        }`}>
                                            {face.name !== "Unknown" ? face.name.charAt(0).toUpperCase() : "?"}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-white/90 truncate">{face.name}</p>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${statusConfig.cls}`}>
                                                    {statusConfig.label}
                                                </span>
                                                {face.confidence > 0 && (
                                                    <span className="text-[9px] text-white/30">{Math.round(face.confidence * 100)}%</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sidebar footer — confirmed total */}
                        <div className="px-3 py-2 border-t border-white/10 bg-black/20">
                            <div className="flex justify-between text-[10px] text-white/50">
                                <span>Attendance marked</span>
                                <span className="text-green-400 font-semibold">
                                    {facesList.filter(f => f.status === "confirmed" || f.status === "provisional").length} / {facesList.filter(f => f.status !== "unknown").length}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls — full width */}
            <button
                onClick={isStreaming ? stopStreaming : startStreaming}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${isStreaming
                    ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                    : "bg-accent/20 border border-accent/30 text-accent hover:bg-accent/30"}`}
            >
                {isStreaming ? <><VideoOff className="w-4 h-4" /> Stop Streaming</> : <><Video className="w-4 h-4" /> Start Streaming</>}
            </button>
        </div>
    );
}

export function StreamViewer({ cameraId }: { cameraId: string }) {
    const imgRef = useRef<HTMLImageElement>(null);
    const [aiData, setAiData] = useState<any[]>([]);

    useEffect(() => {
        const wsUrl = getWsUrl(`/ws/stream/${cameraId}?client_type=receiver`);
        let ws: WebSocket;
        const connect = () => {
            ws = new WebSocket(wsUrl);
            ws.onmessage = (event) => {
                if (typeof event.data === "string") {
                    if (event.data === "__ping__") {
                        ws.send("__pong__");
                        return;
                    }
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
