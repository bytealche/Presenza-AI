"use client";

import React, { useRef, useState, useEffect } from "react";
import { Camera, Video, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import api from "@/services/api";

interface Props {
  userId: number;
  userName: string;
  onSuccess?: () => void;
}

export default function ActiveFaceEnrollment({ userId, userName, onSuccess }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setError(`Camera access denied: ${err.message}`);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleDataAvailable = (e: BlobEvent) => {
    if (e.data.size > 0) {
      setRecordedChunks((prev) => [...prev, e.data]);
    }
  };

  const startRecording = () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    setError(null);
    setSuccess(null);
    setRecordedChunks([]);
    setCapturing(true);
    setRecordingComplete(false);
    setProgress(0);

    const stream = videoRef.current.srcObject as MediaStream;
    try {
      // Try to record in widely supported formats
      const options = { mimeType: "video/webm" };
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = handleDataAvailable;
      mediaRecorder.start(100); // collect 100ms chunks

      // Simulate 10-second progress
      let p = 0;
      const interval = setInterval(() => {
        p += 2; // 2% every 200ms = 100% in 10 seconds
        setProgress(p);
        if (p >= 100) {
          clearInterval(interval);
          stopRecording();
        }
      }, 200);
      
      // Store interval to clear on unmount if needed
      (window as any)._recInterval = interval;
    } catch (e: any) {
      setError("Recording failed to start.");
      setCapturing(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setCapturing(false);
      setRecordingComplete(true);
      clearInterval((window as any)._recInterval);
    }
  };

  const submitVideoProfile = async () => {
    if (recordedChunks.length === 0) return;
    setUploading(true);
    setError(null);

    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const formData = new FormData();
    formData.append("user_id", userId.toString());
    formData.append("file", blob, "face_profile.webm");

    try {
      const res = await api.post("/users/register-video-profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess(`Profile registered! Analyzed ${res.data.frames_analyzed} frames.`);
      if (onSuccess) onSuccess();
      
      // Release camera
      stopCamera();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to upload video profile.");
    } finally {
      setUploading(false);
    }
  };

  const retry = () => {
    setRecordedChunks([]);
    setRecordingComplete(false);
    setSuccess(null);
    setError(null);
    startCamera(); // Restart camera view
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      clearInterval((window as any)._recInterval);
    };
  }, []);

  return (
    <div className="bg-black/30 p-6 rounded-xl border border-white/10 space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">Enroll Face Profile for {userName}</h3>
        <p className="text-sm text-muted">
          We need to record a short 10-second video of the user's face. Please ensure the user looks directly at the camera, then slowly moves their head left, right, up, and down.
        </p>
      </div>

      <div className="relative aspect-video max-w-2xl mx-auto rounded-xl overflow-hidden bg-black border border-white/20 shadow-[0_0_20px_-5px_rgba(16,185,129,0.2)]">
        {!recordingComplete ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${capturing ? "scale-[1.02] transition-transform duration-1000" : ""}`}
          />
        ) : success ? (
          <div className="flex flex-col items-center justify-center h-full bg-green-500/10">
            <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
            <p className="text-green-400 font-medium">Successfully Enrolled</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-secondary">
             <Video className="w-16 h-16 text-muted mb-4 opacity-50" />
             <p className="text-muted">Recording Captured. Ready to upload.</p>
          </div>
        )}

        {/* Overlays */}
        {capturing && (
          <div className="absolute inset-0 border-4 border-red-500/50 rounded-xl pointer-events-none animate-pulse" />
        )}
        
        {capturing && (
          <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold font-mono animate-pulse flex items-center">
            <div className="w-2 h-2 bg-white rounded-full mr-2" /> RECORDING
          </div>
        )}

        {capturing && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-3/4 max-w-sm">
            <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/20">
              <div 
                className="h-full bg-red-500 transition-all duration-200" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <p className="text-center text-xs text-white mt-2 drop-shadow-md font-medium">
              Look left and right slowly...
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm flex-1">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg flex items-center gap-3 text-green-400">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm flex-1">{success}</p>
        </div>
      )}

      <div className="flex justify-center gap-4">
        {!recordingComplete && !capturing && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 bg-accent hover:bg-accent/80 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-[0_0_15px_-5px_var(--color-accent)]"
          >
            <Camera className="w-5 h-5" /> Start 10s Enrollment
          </button>
        )}
        
        {capturing && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-[0_0_15px_-5px_red]"
          >
            <Video className="w-5 h-5" /> Stop Early
          </button>
        )}

        {recordingComplete && !success && (
           <>
            <button
              onClick={retry}
              disabled={uploading}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-full font-semibold transition-all disabled:opacity-50"
            >
              <RefreshCw className="w-5 h-5" /> Retake
            </button>
            <button
              onClick={submitVideoProfile}
              disabled={uploading}
              className="flex items-center gap-2 bg-accent hover:bg-accent/80 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-[0_0_15px_-5px_var(--color-accent)] disabled:opacity-50"
            >
              {uploading ? (
                <> <RefreshCw className="w-5 h-5 animate-spin" /> Uploading & Processing... </>
              ) : (
                <> <CheckCircle className="w-5 h-5" /> Submit Profile </>
              )}
            </button>
           </>
        )}
        
        {success && (
            <button
              onClick={retry}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-full font-semibold transition-all"
            >
              <Camera className="w-5 h-5" /> Enroll Another Device / Retake
            </button>
        )}
      </div>
    </div>
  );
}
