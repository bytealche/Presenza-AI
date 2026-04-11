"use client";

import React, { useState, useRef } from "react";
import { sendOTP, resetPassword } from "@/services/authService";
import { useRouter } from "next/navigation";
import { Mail, Lock, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2>(1);
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [resendCooldown, setResendCooldown] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError("Please enter your email.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await sendOTP(email);
            setSuccess("OTP sent! Please check your email.");
            setStep(2);
            startCooldown();
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to send reset code.");
        } finally {
            setLoading(false);
            setTimeout(() => setSuccess(""), 3000);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }
        if (!otp) {
            setError("Please enter the OTP.");
            return;
        }

        setLoading(true);
        setError("");
        try {
            await resetPassword({ email, otp, new_password: newPassword });
            setSuccess("Password reset successfully! Redirecting to login...");
            setTimeout(() => router.push("/login"), 2000);
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to reset password.");
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
                        {step === 1 ? "Forgot Password" : "Reset Password"}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                        {step === 1 ? "Enter your email to receive a secure recovery code." : "Enter your recovery code and new password."}
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

                {step === 1 ? (
                    <form className="mt-8 space-y-6" onSubmit={handleSendOTP}>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                            <input
                                type="email"
                                required
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !email}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold shadow-lg transition-all ${loading || !email
                                ? "bg-white/5 text-muted cursor-not-allowed"
                                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"
                                }`}
                        >
                            {loading ? "Sending..." : "Get OTP"}
                            {!loading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </form>
                ) : (
                    <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
                        <div className="space-y-4">
                            <div className="relative">
                                <ShieldCheck className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input type="text" required
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                    placeholder="Enter 6-digit OTP" value={otp}
                                    onChange={(e) => setOtp(e.target.value)} />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input type="password" required
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                    placeholder="New Password" value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)} />
                            </div>
                        </div>

                        {/* Resend OTP row */}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted">Didn&apos;t receive OTP?</span>
                            <button type="button"
                                onClick={async () => {
                                    if (resendCooldown > 0) return;
                                    setLoading(true);
                                    try { await sendOTP(email); setSuccess("OTP resent!"); startCooldown(); }
                                    catch (e: any) { setError(e.response?.data?.detail || "Failed to resend."); }
                                    finally { setLoading(false); }
                                }}
                                disabled={resendCooldown > 0}
                                className="text-accent hover:underline disabled:opacity-50 disabled:no-underline min-w-[90px] text-right transition-opacity">
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                            </button>
                        </div>

                        <button type="submit" disabled={loading || !otp || !newPassword}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold shadow-lg transition-all ${loading || !otp || !newPassword
                                ? "bg-white/5 text-muted cursor-not-allowed"
                                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"}`}>
                            {loading ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>
                )}

                <div className="text-center mt-4 pt-4 border-t border-white/10">
                    <Link href="/login" className="flex items-center justify-center text-sm text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
