"use client";

import { useState } from "react";
import { login, getOrganizationsByEmail } from "@/services/authService";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { ArrowRight, User, Lock, Building } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizations, setOrganizations] = useState<Array<{ org_id: number; org_name: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | "">("");
  const [checkingOrgs, setCheckingOrgs] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth(); // Now this relies on AuthContextProvider in layout

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (organizations.length > 1 && !selectedOrgId) {
      setError("Please select an organization");
      setLoading(false);
      return;
    }

    try {
      const data = await login({
        email,
        password,
        org_id: selectedOrgId ? Number(selectedOrgId) : undefined
      });
      // data should contain { access_token: "..." }
      if (data && data.access_token) {
        auth.login(data.access_token);
        router.push("/dashboard");
      } else {
        setError("Invalid response from server");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Floating Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full space-y-8 bg-[var(--glass-bg)] backdrop-blur-xl p-8 rounded-2xl border border-[var(--glass-border)] shadow-2xl relative z-10 transition-all duration-300">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted">
            Presenza
          </h1>
          <h2 className="mt-2 text-lg text-muted">
            Sign in to your account
          </h2>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                placeholder="Email address"
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

            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg pl-10 pr-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-accent hover:text-accent/80 transition-colors ml-auto"
            >
              Forgot your password?
            </Link>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || checkingOrgs}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white transition-all shadow-[0_0_20px_-5px_var(--color-accent)] ${loading || checkingOrgs
                ? "bg-accent/50 cursor-not-allowed"
                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"
                }`}
            >
              {loading ? "Authenticating..." : checkingOrgs ? "Checking Organizations..." : "Sign in"}
              {!loading && !checkingOrgs && <ArrowRight className="ml-2 w-4 h-4" />}
            </button>
          </div>
          <p className="mt-2 text-center text-sm text-muted">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-accent hover:text-accent/80 transition-colors"
            >
              Register here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
