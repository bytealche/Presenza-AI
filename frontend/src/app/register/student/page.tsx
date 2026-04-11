"use client";

import React, { useState, useEffect, useRef } from "react";
import { registerWithFace, sendOTP, getOrganizations } from "@/services/authService";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, ArrowRight, ShieldCheck, Building, Camera, X, CheckCircle } from "lucide-react";
import Link from "next/link";
import Webcam from "react-webcam";

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
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const webcamRef = useRef<Webcam>(null);
    const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string | undefined>(undefined);

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(devs => {
            const vids = devs.filter(d => d.kind === "videoinput");
            setCameraDevices(vids);
        }).catch(console.error);
    }, []);

    // Registered user data to carry into step 2
    const [registeredPayload, setRegisteredPayload] = useState<FormData | null>(null);

    useEffect(() => {
        getOrganizations().then(setOrganizations).catch(console.error);
    }, []);

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

    const capture = React.useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) setCapturedImage(imageSrc);
    }, [webcamRef]);

    const retake = () => setCapturedImage(null);

    // Step 1: Validate and collect form, then proceed to Step 2 (org selection)
    const handleStep1Submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); setSuccess("");

        if (!capturedImage) { setError("Please capture your face for attendance."); return; }
        if (formData.password.length < 8) { setError("Password must be at least 8 characters."); return; }
        if (formData.password.length > 64) { setError("Password cannot exceed 64 characters."); return; }

        // Build the FormData
        const res = await fetch(capturedImage);
        const blob = await res.blob();
        const file = new File([blob], "student_face.jpg", { type: "image/jpeg" });

        const payload = new FormData();
        payload.append("full_name", formData.full_name);
        payload.append("email", formData.email);
        payload.append("password", formData.password);
        payload.append("otp", formData.otp);
        payload.append("role_id", "3");
        payload.append("file", file);

        setRegisteredPayload(payload);
        setStep(2);
    };

    // Step 2: Organisation selected, submit registration
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
            setStep(1); // Go back if error
        } finally { setLoading(false); }
    };

    const inputClass = "w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all";

    return (
        <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-md w-full space-y-8 bg-secondary/30 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl relative z-10 transition-all">

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-3 mb-2">
                    <div className={`flex items-center gap-2 text-sm font-medium transition-all ${step === 1 ? "text-accent" : "text-green-400"}`}>
                        {step > 1 ? <CheckCircle className="w-4 h-4" /> : <span className="w-5 h-5 rounded-full border-2 border-accent flex items-center justify-center text-xs text-accent">1</span>}
                        <span>Account</span>
                    </div>
                    <div className="flex-1 h-px bg-white/10" />
                    <div className={`flex items-center gap-2 text-sm font-medium transition-all ${step === 2 ? "text-accent" : "text-muted"}`}>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${step === 2 ? "border-accent text-accent" : "border-white/20 text-muted"}`}>2</span>
                        <span>Organisation</span>
                    </div>
                </div>

                <div className="text-center">
                    <h2 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        {step === 1 ? "Student Register" : "Join Organisation"}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                        {step === 1 ? "Create your account with face registration." : "Select the organisation you belong to."}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                        <ShieldCheck className="w-4 h-4 text-red-400" /> {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-400" /> {success}
                    </div>
                )}

                {/* ─── STEP 1: Registration Form ─── */}
                {step === 1 && (
                    <form className="mt-4 space-y-4" onSubmit={handleStep1Submit}>
                        <div className="relative">
                            <User className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                            <input name="full_name" type="text" required className={inputClass} placeholder="Full Name"
                                value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
                        </div>

                        {/* Face Capture */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-300">Face Registration</label>

                            {/* Camera device selector */}
                            {cameraDevices.length > 1 && (
                                <select
                                    className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-accent outline-none mb-1"
                                    value={selectedCamera || ""}
                                    onChange={e => { setSelectedCamera(e.target.value); setCapturedImage(null); }}
                                >
                                    {cameraDevices.map((d, i) => (
                                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
                                    ))}
                                </select>
                            )}

                            <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/40 aspect-video flex items-center justify-center">
                                {capturedImage ? (
                                    <>
                                        <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                                        <button type="button" onClick={retake}
                                            className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full hover:bg-red-600 transition-colors">
                                            <X className="w-4 h-4 text-white" />
                                        </button>
                                    </>
                                ) : (
                                    <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg"
                                        videoConstraints={selectedCamera ? { deviceId: { exact: selectedCamera } } : { facingMode: "user" }}
                                        className="w-full h-full object-cover" />
                                )}
                            </div>
                            {!capturedImage && (
                                <button type="button" onClick={capture}
                                    className="w-full py-2 bg-accent/20 border border-accent/50 text-accent rounded-lg hover:bg-accent/30 transition-colors flex items-center justify-center gap-2">
                                    <Camera className="w-4 h-4" /> Capture Face
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input name="email" type="email" required className={inputClass} placeholder="Email Address"
                                    value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <button type="button" onClick={handleSendOTP} disabled={loading || resendCooldown > 0}
                                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-50 whitespace-nowrap border border-white/10 transition-colors min-w-[72px] text-center">
                                {resendCooldown > 0 ? `${resendCooldown}s` : otpSent ? "Resend" : "Get OTP"}
                            </button>
                        </div>

                        {otpSent && (
                            <div className="relative">
                                <ShieldCheck className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input name="otp" type="text" required className={inputClass} placeholder="Enter 6-digit OTP"
                                    value={formData.otp} onChange={(e) => setFormData({ ...formData, otp: e.target.value })} />
                            </div>
                        )}

                        <div className="relative">
                            <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                            <input name="password" type="password" required className={inputClass} placeholder="Password"
                                value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                        </div>

                        <button type="submit" disabled={!otpSent}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold shadow-lg transition-all ${!otpSent
                                ? "bg-white/5 text-muted cursor-not-allowed"
                                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"}`}>
                            Continue <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>
                )}

                {/* ─── STEP 2: Organisation Selection ─── */}
                {step === 2 && (
                    <form className="mt-4 space-y-6" onSubmit={handleStep2Submit}>
                        <div className="space-y-3">
                            {organizations.map(org => (
                                <label key={org.org_id}
                                    className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${formData.org_id === String(org.org_id)
                                        ? "border-accent bg-accent/10 shadow-[0_0_20px_-5px_var(--color-accent)]"
                                        : "border-white/10 bg-white/5 hover:border-white/20"}`}>
                                    <input type="radio" name="org_id" value={org.org_id} className="hidden"
                                        checked={formData.org_id === String(org.org_id)}
                                        onChange={() => setFormData({ ...formData, org_id: String(org.org_id) })} />
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${formData.org_id === String(org.org_id) ? "border-accent" : "border-white/30"}`}>
                                        {formData.org_id === String(org.org_id) && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                                    </div>
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                                            <Building className="w-5 h-5 text-accent" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white text-sm">{org.org_name}</p>
                                            <p className="text-xs text-muted capitalize">{org.org_type}</p>
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button type="button" onClick={() => setStep(1)}
                                className="flex-1 py-3 rounded-lg border border-white/10 text-muted hover:text-white hover:border-white/20 transition-all text-sm">
                                ← Back
                            </button>
                            <button type="submit" disabled={loading || !formData.org_id}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold transition-all ${loading || !formData.org_id
                                    ? "bg-white/5 text-muted cursor-not-allowed"
                                    : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"}`}>
                                {loading ? "Registering..." : "Complete Registration"}
                                {!loading && <CheckCircle className="w-5 h-5" />}
                            </button>
                        </div>
                    </form>
                )}

                <div className="text-center mt-4">
                    <Link href="/register" className="text-sm text-gray-400 hover:text-white transition-colors">
                        ← Back to Role Selection
                    </Link>
                </div>
            </div>
        </div>
    );
}
