"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
    Video, 
    VideoOff, 
    Camera, 
    Wifi, 
    Activity, 
    RefreshCw, 
    CheckCircle2, 
    AlertTriangle, 
    ArrowLeft, 
    Sliders, 
    Database 
} from "lucide-react";

import { getWsUrl } from "@/utils/config";

export default function BroadcastPage() {
    const params = useParams();
    const router = useRouter();
    const cameraId = params.id as string;

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // Stream settings states
    const [targetFps, setTargetFps] = useState(12);
    const [jpegQuality, setJpegQuality] = useState(0.5);

    // Refs to read fresh values in requestAnimationFrame closure
    const currentFpsRef = useRef(12);
    const currentQualityRef = useRef(0.5);

    useEffect(() => {
        currentFpsRef.current = targetFps;
    }, [targetFps]);

    useEffect(() => {
        currentQualityRef.current = jpegQuality;
    }, [jpegQuality]);

    // Streaming status & hardware devices
    const [status, setStatus] = useState("Initializing camera...");
    const [isStreaming, setIsStreaming] = useState(false);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

    // Performance diagnostics state
    const [stats, setStats] = useState({
        actualFps: 0,
        bandwidthKbps: 0,
        droppedFrames: 0,
        totalBytesSent: 0,
        networkStatus: "excellent" as "excellent" | "good" | "slow" | "congested",
    });

    // Toggle settings panel state
    const [showSettings, setShowSettings] = useState(false);

    // 1. Enumerate and initialize video inputs
    useEffect(() => {
        const initDevices = async () => {
            try {
                // Request camera permission upfront so we can discover camera names/labels
                await navigator.mediaDevices.getUserMedia({ video: true });
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter(d => d.kind === "videoinput");
                setDevices(videoDevices);

                // Auto-prefer rear camera ("back" or "environment") on mobile for class stream
                const backCam = videoDevices.find(d => 
                    d.label.toLowerCase().includes("back") || 
                    d.label.toLowerCase().includes("environment") ||
                    d.label.toLowerCase().includes("rear")
                );

                if (backCam) {
                    setSelectedDeviceId(backCam.deviceId);
                } else if (videoDevices.length > 0) {
                    setSelectedDeviceId(videoDevices[0].deviceId);
                } else {
                    // Fallback if permission given but device list returns empty (e.g. mock devices)
                    startCamera();
                }
            } catch (err) {
                console.error("Camera access/enumeration error:", err);
                setStatus("Camera permission denied or unavailable");
                // Attempt standard startup fallback
                startCamera();
            }
        };

        initDevices();

        // 2. Open WebSocket
        connectWebSocket();

        return () => {
            if (wsRef.current) wsRef.current.close();
            stopCamera();
        };
    }, []);

    // Hook camera swap when selectedDeviceId changes
    useEffect(() => {
        if (selectedDeviceId) {
            startCamera(selectedDeviceId);
        }
    }, [selectedDeviceId]);

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
    };

    const startCamera = async (deviceId?: string) => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                const isSecure = window.isSecureContext;
                const protocol = window.location.protocol;
                throw new Error(
                    `Camera API not available. Secure Context: ${isSecure}, Protocol: ${protocol}. \n` +
                    `Mobile browsers block camera on HTTP. \n` +
                    `Fix: Open 'chrome://flags' on mobile, search 'Insecure origins treated as secure', enable it, and add this IP.`
                );
            }

            stopCamera();

            const constraints: MediaStreamConstraints = {
                video: deviceId 
                    ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
                    : { facingMode: "environment", width: 640, height: 480 },
                audio: false
            };

            setStatus("Accessing selected camera...");
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setStatus(wsRef.current && wsRef.current.readyState === WebSocket.OPEN ? "Connected & Streaming" : "Camera Ready");
        } catch (err: any) {
            console.error("Error setting camera track:", err);
            const msg = "Camera Error: " + (err.message || err.name);
            setStatus(msg);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "error", message: msg }));
            }
        }
    };

    const connectWebSocket = () => {
        const wsUrl = getWsUrl(`/ws/stream/${cameraId}?client_type=sender`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setStatus("Connected & Streaming");
            setIsStreaming(true);
            ws.send(JSON.stringify({ type: "log", message: "Mobile WS Connected - Advanced Sender Running" }));
            startSendingFrames(ws);
        };

        ws.onclose = () => {
            setStatus("Disconnected. Reconnecting...");
            setIsStreaming(false);
            setStats(prev => ({ ...prev, actualFps: 0, bandwidthKbps: 0 }));
            setTimeout(connectWebSocket, 2000);
        };

        ws.onerror = (err) => {
            console.error("WS connection error:", err);
            setStatus("Connection Error");
        };

        wsRef.current = ws;
    };

    const startSendingFrames = (ws: WebSocket) => {
        let lastFrameTime = performance.now();
        let frameCount = 0;
        let bytesCount = 0;
        let lastStatsTime = performance.now();

        const sendFrame = (now: number) => {
            // Guard conditions
            if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) return;

            // 1. Framerate Pacing Check
            const elapsed = now - lastFrameTime;
            const currentInterval = 1000 / currentFpsRef.current;

            if (elapsed < currentInterval) {
                requestAnimationFrame(sendFrame);
                return;
            }

            // 2. Network Backpressure / Congestion Control Check
            // ws.bufferedAmount contains unsent payload bytes.
            // If it exceeds 64KB, our outbound connection is saturated.
            // Drop this frame to avoid growing buffers and stream latency/lag.
            if (ws.bufferedAmount > 65536) {
                setStats(prev => ({
                    ...prev,
                    droppedFrames: prev.droppedFrames + 1
                }));
                requestAnimationFrame(sendFrame);
                return;
            }

            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas || video.readyState < 2) {
                requestAnimationFrame(sendFrame);
                return;
            }

            const ctx = canvas.getContext("2d");
            if (ctx && video.videoWidth > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                // Draw the video layout onto offscreen canvas
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    if (blob && wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(blob);
                        frameCount++;
                        bytesCount += blob.size;
                        
                        // Update diagnostics every 1 second
                        const statsElapsed = now - lastStatsTime;
                        if (statsElapsed >= 1000) {
                            const actualFps = Math.round((frameCount * 1000) / statsElapsed);
                            const bandwidthKbps = Math.round((bytesCount * 8) / statsElapsed);
                            const totalBytes = bytesCount;
                            
                            setStats(prev => {
                                // Dynamically estimate connection health rating
                                let networkStatus: typeof stats.networkStatus = "excellent";
                                const expectedFrames = (currentFpsRef.current * statsElapsed) / 1000;
                                const ratio = actualFps / (expectedFrames || 1);
                                
                                if (ratio > 0.9) networkStatus = "excellent";
                                else if (ratio > 0.7) networkStatus = "good";
                                else if (ratio > 0.4) networkStatus = "slow";
                                else networkStatus = "congested";

                                return {
                                    ...prev,
                                    actualFps,
                                    bandwidthKbps,
                                    totalBytesSent: prev.totalBytesSent + totalBytes,
                                    networkStatus
                                };
                            });

                            frameCount = 0;
                            bytesCount = 0;
                            lastStatsTime = now;
                        }
                        
                        lastFrameTime = now;
                    }
                    requestAnimationFrame(sendFrame);
                }, "image/jpeg", currentQualityRef.current);
            } else {
                requestAnimationFrame(sendFrame);
            }
        };

        requestAnimationFrame(sendFrame);
    };

    // Apply performance preset helpers
    const applyPreset = (preset: "lite" | "balanced" | "ultra") => {
        if (preset === "lite") {
            setTargetFps(10);
            setJpegQuality(0.4);
        } else if (preset === "balanced") {
            setTargetFps(12);
            setJpegQuality(0.5);
        } else if (preset === "ultra") {
            setTargetFps(15);
            setJpegQuality(0.7);
        }
    };

    // Network status style helper
    const getNetworkBadgeStyles = () => {
        switch (stats.networkStatus) {
            case "excellent":
                return { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", label: "Excellent", dot: "bg-emerald-400" };
            case "good":
                return { bg: "bg-blue-500/10 text-blue-400 border-blue-500/20", label: "Good Connection", dot: "bg-blue-400" };
            case "slow":
                return { bg: "bg-amber-500/10 text-amber-400 border-amber-500/20", label: "Network Slowing", dot: "bg-amber-400 animate-pulse" };
            case "congested":
                return { bg: "bg-rose-500/10 text-rose-400 border-rose-500/20", label: "High Congestion", dot: "bg-rose-400 animate-ping" };
            default:
                return { bg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", label: "Analyzing...", dot: "bg-zinc-400" };
        }
    };

    const netStyle = getNetworkBadgeStyles();

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-white font-sans selection:bg-emerald-500/30">
            {/* Top Navigation & Brand Header */}
            <header className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/60 backdrop-blur-md border-b border-white/5 z-20">
                <Link 
                    href="/dashboard/teacher" 
                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Dashboard</span>
                </Link>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold tracking-wider text-zinc-300 uppercase">Presenza Broadcaster</span>
                </div>
                <div className="w-16" /> {/* Placeholder for alignment */}
            </header>

            {/* Main Interactive Layout */}
            <main className="flex-1 flex flex-col md:flex-row gap-6 p-4 max-w-6xl mx-auto w-full justify-center items-stretch z-10">
                
                {/* Left Stream Window */}
                <div className="flex-1 flex flex-col items-center justify-center">
                    
                    {/* Camera view container with pulsing border */}
                    <div className={`relative w-full aspect-video bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 border-2 ${
                        isStreaming ? "border-emerald-500/30 shadow-emerald-500/5" : "border-rose-500/20 shadow-rose-500/5"
                    }`}>
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover transform scale-x-100"
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Connection State overlay tags */}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-2 pointer-events-none">
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${
                                isStreaming 
                                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/30" 
                                    : "bg-rose-950/80 text-rose-300 border-rose-500/30"
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`} />
                                {isStreaming ? "Live Broadcasting" : "Offline"}
                            </span>

                            {isStreaming && (
                                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${netStyle.bg}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${netStyle.dot}`} />
                                    {netStyle.label}
                                </span>
                            )}
                        </div>

                        {/* Watermark Logo */}
                        <div className="absolute bottom-3 right-3 pointer-events-none opacity-50 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded text-[9px] tracking-widest text-white/80 font-mono">
                            CAM-{cameraId}
                        </div>
                    </div>

                    {/* Quick Info Status Bar */}
                    <div className="w-full mt-3 px-1 text-center">
                        <p className="text-xs text-zinc-400 bg-zinc-900/40 border border-white/5 rounded-lg py-2 px-3 flex items-center justify-center gap-2">
                            <Activity className={`w-3.5 h-3.5 ${isStreaming ? "text-emerald-400 animate-pulse" : "text-zinc-500"}`} />
                            <span className="truncate">{status}</span>
                        </p>
                    </div>
                </div>

                {/* Right Interactive Dashboard Grid & Controls */}
                <div className="w-full md:w-[360px] flex flex-col gap-4">
                    
                    {/* Interactive Diagnostics Dashboard */}
                    <div className="bg-zinc-900/60 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-xl">
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                            <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-400" />
                                <span>Diagnostics</span>
                            </h2>
                            {isStreaming && (
                                <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
                                    Quality: {Math.round(jpegQuality * 100)}%
                                </span>
                            )}
                        </div>

                        {/* Performance Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col justify-between">
                                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Framerate</span>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-lg font-bold font-mono text-emerald-400">
                                        {isStreaming ? stats.actualFps : 0}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">/ {targetFps} FPS</span>
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col justify-between">
                                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Bandwidth</span>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-lg font-bold font-mono text-blue-400">
                                        {isStreaming ? stats.bandwidthKbps : 0}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">kbps</span>
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col justify-between">
                                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                                    <span>Lag Controls</span>
                                    <Database className="w-2.5 h-2.5 text-amber-400" />
                                </span>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-lg font-bold font-mono text-amber-400">
                                        {stats.droppedFrames}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">skipped</span>
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex flex-col justify-between">
                                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Total Sent</span>
                                <div className="mt-1 flex items-baseline gap-0.5 truncate">
                                    <span className="text-base font-bold font-mono text-zinc-300">
                                        {(stats.totalBytesSent / (1024 * 1024)).toFixed(1)}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">MB</span>
                                </div>
                            </div>
                        </div>

                        {/* Backpressure Indicator explanation */}
                        {isStreaming && stats.droppedFrames > 0 && (
                            <p className="mt-3 text-[10px] text-zinc-400 bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 leading-relaxed">
                                <span className="font-semibold text-amber-300">Congestion Control: </span>
                                Skipped {stats.droppedFrames} saturated frames to keep the receiving server latency perfectly real-time and lag-free.
                            </p>
                        )}
                    </div>

                    {/* Camera Selectors and Presets */}
                    <div className="bg-zinc-900/60 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-xl flex flex-col gap-4">
                        
                        {/* Device Selector */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Camera className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Capture Camera Source</span>
                            </label>
                            {devices.length > 0 ? (
                                <div className="relative">
                                    <select
                                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none appearance-none cursor-pointer pr-8"
                                        value={selectedDeviceId}
                                        onChange={e => setSelectedDeviceId(e.target.value)}
                                    >
                                        {devices.map(d => (
                                            <option key={d.deviceId} value={d.deviceId}>
                                                {d.label || `Camera ${devices.indexOf(d) + 1}`}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                        <RefreshCw className="w-3 h-3 animate-spin-slow" />
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full bg-zinc-950/60 border border-dashed border-white/10 rounded-xl p-2 text-center text-xs text-zinc-500">
                                    Default System Camera
                                </div>
                            )}
                        </div>

                        {/* Performance & Latency Presets */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Optimization Preset</span>
                            </label>
                            
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => applyPreset("lite")}
                                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border ${
                                        targetFps === 10 
                                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/5" 
                                            : "bg-zinc-950 border-white/5 text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    Smooth Lite
                                </button>
                                <button
                                    onClick={() => applyPreset("balanced")}
                                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border ${
                                        targetFps === 12 
                                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/5" 
                                            : "bg-zinc-950 border-white/5 text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    Balanced
                                </button>
                                <button
                                    onClick={() => applyPreset("ultra")}
                                    className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border ${
                                        targetFps === 15 
                                            ? "bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-lg shadow-blue-500/5" 
                                            : "bg-zinc-950 border-white/5 text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    Wi-Fi Ultra
                                </button>
                            </div>

                            <p className="text-[10px] text-zinc-500 leading-normal mt-1">
                                {targetFps === 10 && "Lite: 10 FPS, 0.4 Quality. Minimizes bandwidth, best for unstable cellular networks."}
                                {targetFps === 12 && "Balanced: 12 FPS, 0.5 Quality. Ideal match for classroom face scanning."}
                                {targetFps === 15 && "Ultra: 15 FPS, 0.7 Quality. Highly fluid stream, recommended on stable office Wi-Fi."}
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Glowing background shapes for modern aesthetic */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-40">
                <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-blue-500/10 rounded-full blur-[100px]" />
            </div>
        </div>
    );
}
