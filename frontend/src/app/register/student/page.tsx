"use client";

import React, { useState, useEffect, useRef } from "react";
import { registerWithFace, sendOTP, getOrganizations } from "@/services/authService";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, ArrowRight, ShieldCheck, Building, Camera, X } from "lucide-react";
import Link from "next/link";
import Webcam from "react-webcam";

export default function RegisterStudentPage() {
    const router = useRouter();
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        full_name: "",
        email: "",
        password: "",
        otp: "",
        org_id: "", // Mandatory
        role_id: 3 // Student
    });
    const [otpSent, setOtpSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const webcamRef = useRef<Webcam>(null);

    useEffect(() => {
        getOrganizations().then(setOrganizations).catch(console.error);
    }, []);

    const handleSendOTP = async () => {
        if (!formData.email) {
            setError("Please enter an email address.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await sendOTP(formData.email);
            setOtpSent(true);
            setSuccess("OTP sent to your email (check console).");
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to send OTP.");
        } finally {
            setLoading(false);
        }
    };

    const capture = React.useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setCapturedImage(imageSrc);
        }
    }, [webcamRef]);

    const retake = () => {
        setCapturedImage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        if (!formData.org_id) {
            setError("Please select an organization.");
            setLoading(false);
            return;
        }

        if (!capturedImage) {
            setError("Please capture your face for attendance.");
            setLoading(false);
            return;
        }

        if (formData.password.length < 8) {
            setError("Password must be at least 8 characters long.");
            setLoading(false);
            return;
        }

        if (formData.password.length > 64) {
            setError("Password cannot exceed 64 characters.");
            setLoading(false);
            return;
        }

        try {
            // Convert base64 to blob
            const res = await fetch(capturedImage);
            const blob = await res.blob();
            const file = new File([blob], "student_face.jpg", { type: "image/jpeg" });

            const payload = new FormData();
            payload.append("full_name", formData.full_name);
            payload.append("email", formData.email);
            payload.append("password", formData.password);
            payload.append("otp", formData.otp);
            payload.append("org_id", formData.org_id);
            payload.append("role_id", "3");
            payload.append("file", file);

            await registerWithFace(payload);
            setSuccess("Registration successful! Redirecting...");
            setTimeout(() => router.push("/login"), 2000);
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || "Registration failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-md w-full space-y-8 bg-secondary/30 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl relative z-10 transition-all">
                <div className="text-center">
                    <h2 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Student Register
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                        Join as a student. Face registration required.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                        <ShieldCheck className="w-4 h-4 text-red-400" />
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                        <ShieldCheck className="w-4 h-4 text-green-400" />
                        {success}
                    </div>
                )}


                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
                            <Building className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                            <select
                                name="org_id"
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all appearance-none"
                                value={formData.org_id}
                                onChange={(e) => setFormData({ ...formData, org_id: e.target.value })}
                            >
                                <option value="" className="bg-secondary text-muted">Select Organization</option>
                                {organizations.map(org => (
                                    <option key={org.org_id} value={org.org_id} className="bg-secondary text-white">
                                        {org.org_name}
                                    </option>
                                ))}
                            </select>
                        </div>


                        {/* Face Capture Section */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-300">Face Registration</label>
                            <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/40 aspect-video flex items-center justify-center">
                                {capturedImage ? (
                                    <>
                                        <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={retake}
                                            className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full hover:bg-red-600 transition-colors"
                                        >
                                            <X className="w-4 h-4 text-white" />
                                        </button>
                                    </>
                                ) : (
                                    <Webcam
                                        audio={false}
                                        ref={webcamRef}
                                        screenshotFormat="image/jpeg"
                                        videoConstraints={{ facingMode: "user" }}
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                            {!capturedImage && (
                                <button
                                    type="button"
                                    onClick={capture}
                                    className="w-full py-2 bg-accent/20 border border-accent/50 text-accent rounded-lg hover:bg-accent/30 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Camera className="w-4 h-4" />
                                    Capture Face
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
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
                            <button
                                type="button"
                                onClick={handleSendOTP}
                                disabled={loading || otpSent}
                                className="bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg text-xs disabled:opacity-50 whitespace-nowrap border border-white/10 transition-colors"
                            >
                                {otpSent ? "Resend" : "Get OTP"}
                            </button>
                        </div>

                        {otpSent && (
                            <div className="relative">
                                <ShieldCheck className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input
                                    name="otp"
                                    type="text"
                                    required
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                    placeholder="Enter 6-digit OTP"
                                    value={formData.otp}
                                    onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                                />
                            </div>
                        )}

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
                        disabled={loading || !otpSent}
                        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold shadow-lg transition-all ${loading || !otpSent
                            ? "bg-white/5 text-muted cursor-not-allowed"
                            : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"
                            }`}
                    >
                        {loading ? "Processing..." : "Register Student"}
                        {!loading && <ArrowRight className="w-5 h-5" />}
                    </button>
                </form>
                <div className="text-center mt-4">
                    <Link href="/register" className="text-sm text-gray-400 hover:text-white transition-colors">
                        &larr; Back to Role Selection
                    </Link>
                </div>
            </div>
        </div>
    );
}
