"use client";

import { motion } from "framer-motion";
import { MagneticButton } from "./MagneticButton";
import { ArrowRight, Play } from "lucide-react";

export function Hero() {
    return (
        <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background">
            {/* --- Animated Mesh Gradient Background --- */}
            <div className="absolute inset-0 w-full h-full opacity-60 mix-blend-screen pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                        x: [-100, 100, -100],
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-accent/20 rounded-full blur-[140px]"
                />
                <motion.div
                    animate={{
                        scale: [1.2, 1, 1.2],
                        x: [100, -100, 100],
                        y: [-50, 50, -50],
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-violet/20 rounded-full blur-[140px]"
                />
            </div>

            {/* --- Main Content --- */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 text-center flex flex-col items-center">

                {/* Elite Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mb-8 px-4 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md text-xs font-semibold tracking-widest text-muted uppercase flex items-center gap-2"
                >
                    <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse shadow-[0_0_8px_#bdf4ff]"></span>
                    The Future of Engagement
                </motion.div>

                {/* Hero Title */}
                <motion.h1
                    className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.8 }}
                >
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/80 to-muted">
                        Intelligent Presence
                    </span>
                    <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-dark relative inline-block mt-2">
                        Redefined.
                    </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    className="max-w-2xl text-lg md:text-xl text-muted mb-12 sm:px-8 leading-relaxed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 0.8 }}
                >
                    Real-time AI behavioral analysis for the modern enterprise.
                    Experience seamless tracking, instant insights, and absolute precision with
                    <span className="text-accent font-semibold"> Presenza AI</span>.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full sm:w-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                >
                    <div className="w-full sm:w-auto">
                        <MagneticButton>
                            <a href="/login" className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-accent to-accent-dark text-[#00363d] rounded-full font-bold shadow-[0_0_30px_-5px_rgba(189,244,255,0.4)] hover:shadow-[0_0_50px_-10px_rgba(189,244,255,0.6)] transition-all transform hover:-translate-y-0.5 whitespace-nowrap">
                                Initialize System <ArrowRight className="w-5 h-5" />
                            </a>
                        </MagneticButton>
                    </div>

                    <div className="w-full sm:w-auto">
                        <MagneticButton>
                            <a href="https://youtu.be/iChaC_Trtto?si=n0_KnD63EyRjGSM1" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 text-foreground rounded-full font-semibold border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-highlight)] transition-all backdrop-blur-sm whitespace-nowrap">
                                <Play className="w-5 h-5 fill-current" /> Watch Demo
                            </a>
                        </MagneticButton>
                    </div>
                </motion.div>
            </div>

            {/* Bottom Fade */}
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </section>
    );
}
