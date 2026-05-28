"use client";

import React, { useState, useRef } from "react";
import { sendOTP, verifyOTP, resetPassword, getOrganizationsByEmail } from "@/services/authService";
import { useRouter } from "next/navigation";
import { Mail, Lock, ShieldCheck, ArrowRight, ArrowLeft, Building } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [email, setEmail] = useState("");
    const [organizations, setOrganizations] = useState<Array<{ org_id: number; org_name: string }>>([]);
    const [selectedOrgId, setSelectedOrgId] = useState<number | "">("");
    const [checkingOrgs, setCheckingOrgs] = useState(false);
    const [otp, setOtp] = useState("");
    const [otpError, setOtpError] = useState("");
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

    const checkOrganizations = async (emailVal: string) => {
        if (!emailVal || !emailVal.includes("@") || !emailVal.includes(".")) {
            setOrganizations([]);
            setSelectedOrgId("");
            return;
        }
        setCheckingOrgs(true);
        try {
            const orgList = await getOrganizationsByEmail(emailVal);
            setOrganizations(orgList);
            if (orgList.length === 1) {
                setSelectedOrgId(orgList[0].org_id);
            } else {
                setSelectedOrgId("");
            }
        } catch (err) {
            console.error("Failed to fetch organizations for email:", err);
        } finally {
            setCheckingOrgs(false);
        }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setEmail(val);
        if (val.includes("@") && val.includes(".")) {
            checkOrganizations(val);
        } else {
            setOrganizations([]);
            setSelectedOrgId("");
        }
    };

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError("Please enter your email.");
            return;
        }
        if (organizations.length > 1 && !selectedOrgId) {
            setError("Please select your organization.");
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

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp) {
            setOtpError("Please enter the OTP.");
            return;
        }
        setLoading(true);
        setOtpError("");
        setError("");
        try {
            await verifyOTP(email, otp);
            setSuccess("OTP verified successfully! Now set your new password.");
            setStep(3);
        } catch (err: any) {
            const msg = err.response?.data?.detail === "Not Found" ? "Invalid OTP" : (err.response?.data?.detail || "Invalid OTP");
            setOtpError(msg);
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
            await resetPassword({
                email,
                otp,
                new_password: newPassword,
                org_id: selectedOrgId ? Number(selectedOrgId) : undefined
            });
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

            <div className="max-w-md w-full space-y-8 bg-[var(--glass-bg)] backdrop-blur-xl p-8 rounded-2xl border border-[var(--glass-border)] shadow-2xl relative z-10 transition-all">
                <div className="text-center">
                    <h2 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted">
                        {step === 1 ? "Forgot Password" : step === 2 ? "Verify OTP" : "Reset Password"}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                        {step === 1 
                            ? "Enter your email to receive a secure recovery code." 
                            : step === 2 
                                ? "Enter the 6-digit recovery code sent to your email." 
                                : "Enter your new premium password."}
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

                {step === 1 && (
                    <form className="mt-8 space-y-6" onSubmit={handleSendOTP}>
                        <div className="space-y-4">
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={handleEmailChange}
                                />
                            </div>

                            {/* Premium Organization Selector */}
                            {organizations.length > 1 && (
                                <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
                                    <Building className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                                    <select
                                        id="organization"
                                        name="organization"
                                        required
                                        value={selectedOrgId}
                                        onChange={(e) => setSelectedOrgId(e.target.value ? Number(e.target.value) : "")}
                                        className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="" className="bg-background text-foreground">Select Organization</option>
                                        {organizations.map((org) => (
                                            <option key={org.org_id} value={org.org_id} className="bg-background text-foreground">
                                                {org.org_name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted">
                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || checkingOrgs || !email}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold shadow-lg transition-all ${loading || checkingOrgs || !email
                                ? "bg-[var(--glass-highlight)] text-muted cursor-not-allowed"
                                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"
                                }`}
                        >
                            {loading ? "Sending..." : checkingOrgs ? "Checking Organizations..." : "Get OTP"}
                            {!loading && !checkingOrgs && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form className="mt-8 space-y-6" onSubmit={handleVerifyOTP}>
                        <div className="relative">
                            <ShieldCheck className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                            <input type="text" required
                                className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                placeholder="Enter 6-digit OTP" value={otp}
                                onChange={(e) => {
                                    setOtp(e.target.value);
                                    setOtpError("");
                                }} />
                        </div>
                        {otpError && (
                            <p className="-mt-3 text-xs text-red-400 font-medium pl-1 animate-pulse">
                                ⚠️ {otpError}
                            </p>
                        )}

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

                        <button type="submit" disabled={loading || !otp}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold shadow-lg transition-all ${loading || !otp
                                ? "bg-[var(--glass-highlight)] text-muted cursor-not-allowed"
                                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"}`}>
                            {loading ? "Verifying..." : "Verify OTP"}
                            {!loading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </form>
                )}

                {step === 3 && (
                    <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                            <input type="password" required
                                className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                                placeholder="New Password" value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)} />
                        </div>

                        <button type="submit" disabled={loading || !newPassword}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold shadow-lg transition-all ${loading || !newPassword
                                ? "bg-[var(--glass-highlight)] text-muted cursor-not-allowed"
                                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"}`}>
                            {loading ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>
                )}

                <div className="text-center mt-4 pt-4 border-t border-[var(--glass-border)]">
                    <Link href="/login" className="flex items-center justify-center text-sm text-muted hover:text-foreground transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}

