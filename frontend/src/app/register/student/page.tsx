"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { registerWithFace, sendOTP, getOrganizations } from "@/services/authService";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, ArrowRight, ShieldCheck, Building, CheckCircle, Camera, RotateCcw } from "lucide-react";
import Link from "next/link";

// Guided face capture directions
const DIRECTIONS = [
    { label: "Look straight at the camera", icon: "👁️", frames: 15 },
    { label: "Slowly turn head LEFT", icon: "⬅️", frames: 10 },
    { label: "Slowly turn head RIGHT", icon: "➡️", frames: 10 },
    { label: "Tilt head UP slightly", icon: "⬆️", frames: 8 },
    { label: "Tilt head DOWN slightly", icon: "⬇️", frames: 7 },
];
const TOTAL_FRAMES = DIRECTIONS.reduce((a, b) => a + b.frames, 0); // 50

export default function RegisterStudentPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2>(1);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        password: "",
        otp: "",
        org_id: "",
        role_id: 3
    });
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // ── Face capture state ──
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string | undefined>(undefined);
    const [capturedFrames, setCapturedFrames] = useState<Blob[]>([]);
    const [capturePhase, setCapturePhase] = useState<"idle" | "capturing" | "done">("idle");
    const [currentDirection, setCurrentDirection] = useState(0);
    const [directionFrameCount, setDirectionFrameCount] = useState(0);
    const [totalCaptured, setTotalCaptured] = useState(0);
    const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const capturedBlobsRef = useRef<Blob[]>([]);

    // Registered payload for step 2
    const [registeredPayload, setRegisteredPayload] = useState<FormData | null>(null);

    useEffect(() => {
        getOrganizations().then(setOrganizations).catch(console.error);
        navigator.mediaDevices.enumerateDevices().then(devs => {
            const vids = devs.filter(d => d.kind === "videoinput");
            setCameraDevices(vids);
        }).catch(console.error);
    }, []);

    // Start webcam
    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [selectedCamera]);

    const startCamera = async () => {
        stopCamera();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: selectedCamera
                    ? { deviceId: { exact: selectedCamera }, width: 640, height: 480 }
                    : { facingMode: "user", width: 640, height: 480 },
                audio: false
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
        } catch (e) {
            console.error("Camera error", e);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
    };

    const startCooldown = () => {
        setResendCooldown(30);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const handleSendOTP = async () => {
        if (!formData.email) { setError("Please enter an email address."); return; }
        setLoading(true); setError("");
        try {
            await sendOTP(formData.email);
            setOtpSent(true);
            setSuccess("OTP sent to your email.");
            startCooldown();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to send OTP.");
        } finally { setLoading(false); }
    };

    // ── 50-frame guided capture ──
    const startCapture = useCallback(() => {
        capturedBlobsRef.current = [];
        setCapturedFrames([]);
        setTotalCaptured(0);
        setCurrentDirection(0);
        setDirectionFrameCount(0);
        setCapturePhase("capturing");

        let dirIdx = 0;
        let dirFrames = 0;
        let totalFrames = 0;

        captureIntervalRef.current = setInterval(() => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas || video.videoWidth === 0) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Mirror horizontally for selfie view
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            ctx.restore();

            canvas.toBlob(blob => {
                if (!blob) return;
                capturedBlobsRef.current.push(blob);
                totalFrames++;
                dirFrames++;

                setTotalCaptured(totalFrames);
                setDirectionFrameCount(dirFrames);

                // Move to next direction
                if (dirFrames >= DIRECTIONS[dirIdx].frames) {
                    dirIdx++;
                    dirFrames = 0;
                    setCurrentDirection(dirIdx < DIRECTIONS.length ? dirIdx : DIRECTIONS.length - 1);
                    setDirectionFrameCount(0);
                }

                // Done
                if (totalFrames >= TOTAL_FRAMES) {
                    clearInterval(captureIntervalRef.current!);
                    setCapturedFrames([...capturedBlobsRef.current]);
                    setCapturePhase("done");
                }
            }, "image/jpeg", 0.8);
        }, 200); // 5fps capture rate = 10 seconds for 50 frames
    }, []);

    const resetCapture = () => {
        if (captureIntervalRef.current) clearInterval(captureIntervalRef.current);
        capturedBlobsRef.current = [];
        setCapturedFrames([]);
        setTotalCaptured(0);
        setCurrentDirection(0);
        setCapturePhase("idle");
    };

    // Step 1: Validate and move to org step
    const handleStep1Submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setSuccess("");

        if (capturePhase !== "done" || capturedFrames.length < TOTAL_FRAMES) {
            setError(`Please complete face capture (${TOTAL_FRAMES} frames required).`);
            return;
        }
        if (formData.password.length < 8) { setError("Password must be at least 8 characters."); return; }
        if (formData.password.length > 64) { setError("Password cannot exceed 64 characters."); return; }

        // Use the best (middle) frame as the profile photo
        const bestFrame = capturedFrames[Math.floor(capturedFrames.length / 2)];
        const file = new File([bestFrame], "student_face.jpg", { type: "image/jpeg" });

        const payload = new FormData();
        payload.append("full_name", formData.full_name);
        payload.append("email", formData.email);
        payload.append("password", formData.password);
        payload.append("otp", formData.otp);
        payload.append("role_id", "3");
        payload.append("file", file);

        setRegisteredPayload(payload);
        stopCamera();
        setStep(2);
    };

    // Step 2: Submit with org
    const handleStep2Submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.org_id) { setError("Please select an organisation."); return; }
        if (!registeredPayload) return;

        setLoading(true); setError(""); setSuccess("");
        try {
            registeredPayload.set("org_id", formData.org_id);
            await registerWithFace(registeredPayload);
            setSuccess("Registration successful! Redirecting...");
            setTimeout(() => router.push("/login"), 2000);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Registration failed.");
            setStep(1);
            startCamera();
        } finally { setLoading(false); }
    };

    const inputClass = "w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all";

    const currentDir = DIRECTIONS[currentDirection] ?? DIRECTIONS[DIRECTIONS.length - 1];
    const progress = Math.min((totalCaptured / TOTAL_FRAMES) * 100, 100);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-md w-full space-y-6 bg-[var(--glass-bg)] backdrop-blur-xl p-8 rounded-2xl border border-[var(--glass-border)] shadow-2xl relative z-10">

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-3">
                    <div className={`flex items-center gap-2 text-sm font-medium ${step === 1 ? "text-accent" : "text-green-400"}`}>
                        {step > 1 ? <CheckCircle className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full border-2 border-accent flex items-center justify-center text-xs text-accent">1</span>}
                        <span>Account</span>
                    </div>
                    <div className="flex-1 h-px bg-white/10" />
                    <div className={`flex items-center gap-2 text-sm font-medium ${step === 2 ? "text-accent" : "text-muted"}`}>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${step === 2 ? "border-accent text-accent" : "border-white/20 text-muted"}`}>2</span>
                        <span>Organisation</span>
                    </div>
                </div>

                <div className="text-center">
                    <h2 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted">
                        {step === 1 ? "Student Register" : "Join Organisation"}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                        {step === 1 ? "Create your account with guided face registration." : "Select the organisation you belong to."}
                    </p>
                </div>

                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm"><ShieldCheck className="w-4 h-4 text-red-400 shrink-0" /> {error}</div>}
                {success && <div className="bg-green-500/10 border border-green-500/20 text-green-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 text-green-400 shrink-0" /> {success}</div>}

                {/* ─── STEP 1 ─── */}
                {step === 1 && (
                    <form className="space-y-4" onSubmit={handleStep1Submit}>
                        <div className="relative">
                            <User className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                            <input name="full_name" type="text" required className={inputClass} placeholder="Full Name"
                                value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                        </div>

                        {/* ── Face Capture Section ── */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-muted">Face Registration (50 frames)</label>
                                {cameraDevices.length > 1 && (
                                    <select className="bg-background border border-[var(--glass-border)] rounded px-2 py-1 text-xs text-foreground focus:border-accent outline-none"
                                        value={selectedCamera || ""}
                                        onChange={e => { setSelectedCamera(e.target.value); resetCapture(); }}
                                        disabled={capturePhase === "capturing"}>
                                        {cameraDevices.map((d, i) => (
                                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Video preview */}
                            <div className="relative rounded-lg overflow-hidden border border-[var(--glass-border)] bg-black aspect-video">
                                <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
                                <canvas ref={canvasRef} className="hidden" />

                                {/* Direction overlay */}
                                {capturePhase === "capturing" && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-between p-3 pointer-events-none">
                                        {/* Direction banner */}
                                        <div className="bg-[var(--glass-bg)] backdrop-blur-sm px-4 py-2 rounded-full text-foreground text-sm font-medium flex items-center gap-2">
                                            <span className="text-lg">{currentDir.icon}</span>
                                            {currentDir.label}
                                        </div>

                                        {/* Frame counter */}
                                        <div className="w-full space-y-1">
                                            <div className="flex justify-between text-xs text-muted px-1">
                                                <span>Capturing frames...</span>
                                                <span className="font-mono font-bold text-accent">{totalCaptured}/{TOTAL_FRAMES}</span>
                                            </div>
                                            <div className="w-full h-2 bg-[var(--glass-highlight)] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-accent to-purple-500 transition-all duration-200"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Done overlay */}
                                {capturePhase === "done" && (
                                    <div className="absolute inset-0 bg-green-900/60 flex flex-col items-center justify-center gap-2">
                                        <CheckCircle className="w-12 h-12 text-green-400" />
                                        <p className="text-foreground font-semibold">50 frames captured!</p>
                                        <button type="button" onClick={resetCapture}
                                            className="flex items-center gap-1 text-xs bg-[var(--glass-highlight)] hover:bg-[var(--glass-highlight)]/80 text-foreground px-3 py-1.5 rounded-full transition-colors">
                                            <RotateCcw className="w-3 h-3" /> Retake
                                        </button>
                                    </div>
                                )}

                                {/* Idle overlay */}
                                {capturePhase === "idle" && (
                                    <div className="absolute inset-0 flex items-end justify-center pb-3">
                                        <div className="text-xs text-muted bg-[var(--glass-highlight)] px-3 py-1 rounded-full">
                                            Position your face in the frame
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Direction guide cards */}
                            <div className="grid grid-cols-5 gap-1">
                                {DIRECTIONS.map((dir, i) => {
                                    const isActive = capturePhase === "capturing" && i === currentDirection;
                                    const isDone = capturePhase === "capturing"
                                        ? i < currentDirection
                                        : capturePhase === "done";
                                    return (
                                        <div key={i} className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-center transition-all ${isActive ? "border-accent bg-accent/10" : isDone ? "border-green-500/30 bg-green-500/10" : "border-[var(--glass-border)] bg-[var(--glass-highlight)]"}`}>
                                            <span className="text-base">{isDone ? "✅" : dir.icon}</span>
                                            <span className={`text-[9px] leading-tight ${isActive ? "text-accent" : isDone ? "text-green-400" : "text-muted"}`}>
                                                {dir.frames}f
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Capture button */}
                            {capturePhase === "idle" && (
                                <button type="button" onClick={startCapture}
                                    className="w-full py-2.5 bg-accent/20 border border-accent/50 text-accent rounded-lg hover:bg-accent/30 transition-colors flex items-center justify-center gap-2 font-medium">
                                    <Camera className="w-4 h-4" /> Start 50-Frame Capture
                                </button>
                            )}
                            {capturePhase === "capturing" && (
                                <div className="w-full py-2 text-center text-sm text-muted animate-pulse">
                                    📸 Capturing — follow the directions above...
                                </div>
                            )}
                        </div>

                        {/* Email + OTP */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input name="email" type="email" required className={inputClass} placeholder="Email Address"
                                    value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <button type="button" onClick={handleSendOTP} disabled={loading || resendCooldown > 0}
                                className="bg-[var(--glass-highlight)] hover:bg-[var(--glass-highlight)]/80 text-foreground px-3 py-2 rounded-lg text-xs disabled:opacity-50 whitespace-nowrap border border-[var(--glass-border)] transition-colors min-w-[72px] text-center">
                                {resendCooldown > 0 ? `${resendCooldown}s` : otpSent ? "Resend" : "Get OTP"}
                            </button>
                        </div>

                        {otpSent && (
                            <div className="relative">
                                <ShieldCheck className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input name="otp" type="text" required className={inputClass} placeholder="Enter 6-digit OTP"
                                    value={formData.otp} onChange={e => setFormData({ ...formData, otp: e.target.value })} />
                            </div>
                        )}

                        <div className="relative">
                            <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                            <input name="password" type="password" required className={inputClass} placeholder="Password"
                                value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                        </div>

                        <button type="submit" disabled={!otpSent || capturePhase !== "done"}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold shadow-lg transition-all ${!otpSent || capturePhase !== "done"
                                ? "bg-[var(--glass-highlight)] text-muted cursor-not-allowed"
                                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"}`}>
                            Continue to Organisation <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>
                )}

                {/* ─── STEP 2: Organisation ─── */}
                {step === 2 && (
                    <form className="space-y-6" onSubmit={handleStep2Submit}>
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                            {organizations.map(org => (
                                <label key={org.org_id}
                                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${formData.org_id === String(org.org_id)
                                        ? "border-accent bg-accent/10 shadow-[0_0_20px_-5px_var(--color-accent)]"
                                        : "border-[var(--glass-border)] bg-[var(--glass-highlight)] hover:border-[var(--glass-highlight)]"}`}>
                                    <input type="radio" name="org_id" value={org.org_id} className="hidden"
                                        checked={formData.org_id === String(org.org_id)}
                                        onChange={() => setFormData({ ...formData, org_id: String(org.org_id) })} />
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${formData.org_id === String(org.org_id) ? "border-accent" : "border-white/30"}`}>
                                        {formData.org_id === String(org.org_id) && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                                    </div>
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                                            <Building className="w-5 h-5 text-accent" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-foreground text-sm">{org.org_name}</p>
                                            <p className="text-xs text-muted capitalize">{org.org_type}</p>
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button type="button" onClick={() => { setStep(1); startCamera(); }}
                                className="flex-1 py-3 rounded-lg border border-[var(--glass-border)] text-muted hover:text-foreground hover:border-[var(--glass-highlight)] transition-all text-sm">
                                ← Back
                            </button>
                            <button type="submit" disabled={loading || !formData.org_id}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold transition-all ${loading || !formData.org_id
                                    ? "bg-[var(--glass-highlight)] text-muted cursor-not-allowed"
                                    : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"}`}>
                                {loading ? "Registering..." : "Complete Registration"}
                                {!loading && <CheckCircle className="w-5 h-5" />}
                            </button>
                        </div>
                    </form>
                )}

                <div className="text-center">
                    <Link href="/register" className="text-sm text-muted hover:text-foreground transition-colors">← Back to Role Selection</Link>
                </div>
            </div>
        </div>
    );
}
