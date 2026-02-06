"use client";

import { useState } from "react";
import { login } from "@/services/authService";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth(); // Now this relies on AuthContextProvider in layout

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await login(email, password);
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
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full space-y-8 bg-secondary/30 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl relative z-10">
        <div>
          <h1 className="text-center text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Presenza
          </h1>
          <h2 className="mt-2 text-center text-lg text-muted">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            Or{" "}
            <Link
              href="/register/face"
              className="font-medium text-accent hover:text-accent/80 transition-colors"
            >
              register directly with face ID
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded relative text-sm">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-white/10 placeholder-muted text-foreground rounded-lg bg-black/20 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm transition-all"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-white/10 placeholder-muted text-foreground rounded-lg bg-black/20 focus:outline-none focus:ring-accent focus:border-accent focus:z-10 sm:text-sm transition-all"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white transition-all shadow-[0_0_20px_-5px_var(--color-accent)] ${loading
                ? "bg-accent/50 cursor-not-allowed"
                : "bg-accent hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
                }`}
            >
              {loading ? "Authenticating..." : "Sign in"}
              {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
