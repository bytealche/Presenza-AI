"use client";

import React, { useState } from "react";
import { registerOrganization, sendOTP, verifyOTP } from "@/services/authService";
import { useRouter } from "next/navigation";
import { Building, Mail, Lock, ArrowRight, ShieldCheck, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function RegisterOrganizationPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        org_name: "",
        email: "",
        password: "",
        otp: ""
    });
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSendOTP = async () => {
        if (!formData.org_name) {
            setError("Please enter your organization name first.");
            return;
        }
        if (!formData.email) {
            setError("Please enter an email address.");
            return;
        }
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            await sendOTP(formData.email);
            setOtpSent(true);
            setSuccess("OTP sent to your email.");
        } catch (err: any) {
            setError(err.response?.data?.detail || "Failed to send OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!formData.otp) {
            setError("Please enter the OTP.");
            return;
        }
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            await verifyOTP(formData.email, formData.otp);
            setOtpVerified(true);
            setSuccess("Email verified successfully! Now set your administrator password.");
        } catch (err: any) {
            setError(err.response?.data?.detail || "Invalid or expired OTP.");
        } finally {
            setLoading(false);
            setTimeout(() => setSuccess(""), 3000);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

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
            await registerOrganization(formData);
            setSuccess("Organization registered successfully! Redirecting to login...");
            setTimeout(() => router.push("/login"), 2000);
        } catch (err: any) {
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

            <div className="max-w-md w-full space-y-8 bg-[var(--glass-bg)] backdrop-blur-xl p-8 rounded-2xl border border-[var(--glass-border)] shadow-2xl relative z-10 transition-all">
                <div className="text-center">
                    <h2 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted">
                        Organization Register
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                        {!otpSent 
                            ? "Start by entering organization details." 
                            : !otpVerified 
                                ? "Verify email ownership with OTP." 
                                : "Create your administrator account."}
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
                            <Building className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                            <input
                                name="org_name"
                                type="text"
                                required
                                disabled={otpSent}
                                className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all disabled:opacity-50"
                                placeholder="Organization Name"
                                value={formData.org_name}
                                onChange={(e) => setFormData({ ...formData, org_name: e.target.value })}
                            />
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    disabled={otpSent}
                                    className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all disabled:opacity-50"
                                    placeholder="Email Address"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            {!otpSent && (
                                <button
                                    type="button"
                                    onClick={handleSendOTP}
                                    disabled={loading || !formData.email || !formData.org_name}
                                    className="bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 text-white px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shadow-lg shadow-accent/25 disabled:opacity-50"
                                >
                                    Get OTP
                                </button>
                            )}
                        </div>

                        {otpSent && !otpVerified && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <ShieldCheck className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                    <input
                                        name="otp"
                                        type="text"
                                        required
                                        className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                        placeholder="Enter 6-digit OTP"
                                        value={formData.otp}
                                        onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setOtpSent(false); setFormData({ ...formData, otp: "" }); }}
                                        className="flex-1 py-2.5 rounded-lg border border-[var(--glass-border)] text-muted hover:text-foreground hover:border-[var(--glass-highlight)] transition-all text-xs"
                                    >
                                        Edit Details
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleVerifyOTP}
                                        disabled={loading || !formData.otp}
                                        className="flex-1 bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 text-white py-2.5 rounded-lg text-xs font-semibold transition-all shadow-lg"
                                    >
                                        {loading ? "Verifying..." : "Verify OTP"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {otpVerified && (
                            <div className="space-y-4">
                                <div className="bg-green-500/10 border border-green-500/20 text-green-200 px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    Email address verified successfully.
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                    <input
                                        name="password"
                                        type="password"
                                        required
                                        className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                        placeholder="Set Password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {otpVerified && (
                        <button
                            type="submit"
                            disabled={loading || !formData.password}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold shadow-lg transition-all ${loading || !formData.password
                                ? "bg-[var(--glass-highlight)] text-muted cursor-not-allowed"
                                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"
                                }`}
                        >
                            {loading ? "Processing..." : "Register Organization"}
                            {!loading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    )}
                </form>
                <div className="text-center mt-4">
                    <Link href="/register" className="text-sm text-muted hover:text-foreground transition-colors">
                        &larr; Back to Role Selection
                    </Link>
                </div>
            </div>
        </div>
    );
}

