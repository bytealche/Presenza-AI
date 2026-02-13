"use client";

import { useState, useRef } from "react";
import { login, loginWithFace } from "@/services/authService";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { ArrowRight, Camera, User, Lock, Video } from "lucide-react";
import Webcam from "react-webcam";

export default function Login() {
  const [activeTab, setActiveTab] = useState("credentials"); // "credentials" or "face"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth(); // Now this relies on AuthContextProvider in layout
  const webcamRef = useRef<Webcam>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await login({ email, password });
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

  const handleFaceLogin = async () => {
    setLoading(true);
    setError("");

    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();

    if (!imageSrc) {
      setError("Could not capture image. Please try again.");
      setLoading(false);
      return;
    }

    try {
      // Convert base64 to blob
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const file = new File([blob], "face_login.jpg", { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);

      const data = await loginWithFace(formData);
      if (data && data.access_token) {
        auth.login(data.access_token);
        router.push("/dashboard");
      } else {
        setError("Face not recognized or unauthorized.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Face login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full space-y-8 bg-secondary/30 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl relative z-10 transition-all duration-300">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Presenza
          </h1>
          <h2 className="mt-2 text-lg text-muted">
            Sign in to your account
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex bg-black/20 rounded-lg p-1">
          <button
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "credentials" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-white"}`}
            onClick={() => { setActiveTab("credentials"); setError(""); }}
          >
            Email & Password
          </button>
          <button
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "face" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-white"}`}
            onClick={() => { setActiveTab("face"); setError(""); }}
          >
            Face Login
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {activeTab === "credentials" ? (
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
                  className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-muted" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
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
                  : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"
                  }`}
              >
                {loading ? "Authenticating..." : "Sign in"}
                {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
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
        ) : (
          <div className="mt-8 space-y-6 flex flex-col items-center">
            <div className="relative rounded-xl overflow-hidden border-2 border-accent/30 shadow-2xl shadow-accent/10 w-full aspect-video bg-black/40">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-[3px] border-accent/20 rounded-xl pointer-events-none"></div>
              <div className="absolute top-4 right-4 animate-pulse">
                <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
              </div>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-white font-semibold">Position your face in the frame</h3>
              <p className="text-muted text-xs px-8">Ensure good lighting and remove any face coverings. Only Faculty and Students can use this feature.</p>
            </div>

            <button
              type="button"
              onClick={handleFaceLogin}
              disabled={loading}
              className={`group relative w-full flex justify-center items-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white transition-all shadow-[0_0_20px_-5px_var(--color-accent)] ${loading
                ? "bg-accent/50 cursor-not-allowed"
                : "bg-gradient-to-r from-accent to-purple-600 hover:from-accent/90 hover:to-purple-600/90 shadow-accent/25"
                }`}
            >
              {loading ? "Verifying..." : "Scan Face & Login"}
              {!loading && <Camera className="ml-2 w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
