"use client";

import React, { useState, useRef, useEffect } from "react";
import { registerWithFace } from "@/services/authService";
import { useRouter } from "next/navigation";
import { Camera, RefreshCw, User, Mail, Lock, ArrowRight, ShieldCheck, Briefcase } from "lucide-react";
import Link from "next/link";

export default function FaceRegistrationPage() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        password: "",
        org_id: 1,
        role_id: 1,
    });

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
    const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Start Webcam
    useEffect(() => {
        const startCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                });
                setStream(mediaStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Error accessing webcam:", err);
                setError("Could not access webcam. Please allow permissions.");
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    // Re-attach stream to video element when retaking
    useEffect(() => {
        if (!capturedImage && videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [capturedImage, stream]);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext("2d");

            if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        setCapturedImage(blob);
                        setCapturedImageUrl(URL.createObjectURL(blob));
                    }
                }, "image/jpeg");
            }
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
        setCapturedImageUrl(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!capturedImage) {
            setError("Please capture an image first.");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const data = new FormData();
            data.append("full_name", formData.full_name);
            data.append("email", formData.email);
            data.append("password", formData.password);
            data.append("org_id", String(formData.org_id));
            data.append("role_id", String(formData.role_id));
            data.append("file", capturedImage, "face.jpg");

            await registerWithFace(data);
            setSuccess("Registration successful! Redirecting to login...");
            setTimeout(() => router.push("/login"), 2000);
        } catch (err: any) {
            console.error(err);
            setError(
                err.response?.data?.detail || "Registration failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-2xl w-full space-y-8 bg-secondary/30 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl relative z-10 transition-all">
                <div className="text-center">
                    <h2 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Biometric Registration
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                        Secure your account with face recognition technology.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-red-400" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-200 px-4 py-3 rounded-lg flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-green-400" />
                        {success}
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-8">
                    {/* Camera Section */}
                    <div className="flex-1 flex flex-col items-center space-y-4">
                        <div className="relative w-full aspect-[4/3] bg-black rounded-lg overflow-hidden ring-1 ring-white/10 shadow-inner group">
                            {!capturedImage ? (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                                />
                            ) : (
                                <img
                                    src={capturedImageUrl!}
                                    alt="Captured"
                                    className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                                />
                            )}

                            {/* Overlay UI */}
                            <div className="absolute inset-0 pointer-events-none border-[1px] border-white/10 rounded-lg">
                                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-accent"></div>
                                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-accent"></div>
                                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-accent"></div>
                                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-accent"></div>
                            </div>
                        </div>

                        <div className="flex w-full">
                            {!capturedImage ? (
                                <button
                                    type="button"
                                    onClick={handleCapture}
                                    className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-lg shadow-lg shadow-accent/20 transition-all font-medium"
                                >
                                    <Camera className="w-4 h-4" /> Capture Face
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleRetake}
                                    className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-lg border border-white/10 transition-all font-medium"
                                >
                                    <RefreshCw className="w-4 h-4" /> Retake
                                </button>
                            )}
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                    </div>

                    {/* Form Section */}
                    <form className="flex-1 space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div className="relative">
                                <User className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input
                                    name="full_name"
                                    type="text"
                                    required
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                    placeholder="Full Name"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                    placeholder="Email Address"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>

                            <div className="relative">
                                <Briefcase className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <select
                                    name="role"
                                    required
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all appearance-none"
                                    value={formData.role_id}
                                    onChange={(e) => setFormData({ ...formData, role_id: Number(e.target.value) })}
                                >
                                    <option value={1} className="bg-secondary">Admin</option>
                                    <option value={2} className="bg-secondary">Teacher</option>
                                    <option value={3} className="bg-secondary">Student</option>
                                </select>
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                    placeholder="Password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !capturedImage}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold shadow-lg transition-all ${loading || !capturedImage
                                    ? "bg-white/5 text-muted cursor-not-allowed"
                                    : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"
                                }`}
                        >
                            {loading ? "Processing..." : "Create Account"}
                            {!loading && <ArrowRight className="w-5 h-5" />}
                        </button>

                        <div className="text-sm text-center pt-2">
                            <Link href="/login" className="font-medium text-accent hover:text-accent/80 transition-colors">
                                Already have an account? Login
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
