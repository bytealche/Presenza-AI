"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Video, VideoOff } from "lucide-react";
import { getWsUrl } from "@/utils/config";

// Streams from the user's own webcam directly to the backend via WebSocket
export function DeviceCameraStreamer({ cameraId }: { cameraId: string }) {
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
                    if (event.data === "__ping__") {
                        // Respond to server heartbeat to keep connection alive
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

            {/* Live preview */}
            <div className="relative w-full aspect-video bg-black rounded overflow-hidden ring-1 ring-black/10">
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
                <div className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded text-xs ${isStreaming ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-black/50 text-white"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
                    {status}
                </div>
            </div>

            {/* Controls */}
            <button
                onClick={isStreaming ? stopStreaming : startStreaming}
                className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${isStreaming
                    ? "bg-red-500/20 border border-red-500/30 text-red-600 hover:bg-red-500/30"
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
