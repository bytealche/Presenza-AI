"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function BroadcastPage() {
    const params = useParams();
    const cameraId = params.id as string;

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wsRef = useRef<WebSocket | null>(null);

    const [status, setStatus] = useState("Initializing...");
    const [isStreaming, setIsStreaming] = useState(false);

    useEffect(() => {
        // 1. Start Camera
        startCamera();

        // 2. Connect WebSocket
        connectWebSocket();

        return () => {
            if (wsRef.current) wsRef.current.close();
        };
    }, []);

    const startCamera = async () => {
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

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: 640, height: 480 },
                audio: false
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err: any) {
            console.error(err);
            const msg = "Error: " + (err.message || err.name);
            setStatus(msg);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "error", message: msg }));
            }
        }
    };

    const connectWebSocket = () => {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/stream/${cameraId}?client_type=sender`;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setStatus("Connected to server");
            setIsStreaming(true);
            ws.send(JSON.stringify({ type: "log", message: "Mobile WS Connected - JS Running" }));
            startSendingFrames(ws);
        };

        ws.onclose = () => {
            setStatus("Disconnected. Reconnecting...");
            setIsStreaming(false);
            setTimeout(connectWebSocket, 2000);
        };

        ws.onerror = (err) => {
            console.error(err);
            setStatus("Connection Error");
        };

        wsRef.current = ws;
    };

    const startSendingFrames = (ws: WebSocket) => {
        const sendFrame = () => {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (!videoRef.current || !canvasRef.current) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");

            if (ctx && video.videoWidth > 0) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    if (blob && ws.readyState === WebSocket.OPEN) ws.send(blob);
                }, "image/jpeg", 0.5); // 0.5 quality for speed
            }

            requestAnimationFrame(sendFrame); // Loop
        };
        sendFrame();
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4">
            <h1 className="text-xl font-bold mb-4">Mobile Broadcaster</h1>
            <div className={`px-4 py-2 rounded mb-4 text-center text-xs whitespace-pre-wrap ${isStreaming ? 'bg-green-600' : 'bg-red-600'}`}>
                {status}
            </div>

            <div className="relative w-full max-w-lg aspect-video bg-gray-800 rounded overflow-hidden">
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                />
            </div>
            <p className="mt-4 text-sm text-gray-400">Keep this screen open to stream.</p>
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
