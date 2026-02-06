"use client";

import { motion } from "framer-motion";
import { MagneticButton } from "./MagneticButton";
import { ArrowRight, Play } from "lucide-react";

export function Hero() {
    return (
        <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background">
            {/* --- Animated Mesh Gradient Background --- */}
            <div className="absolute inset-0 w-full h-full opacity-40 mix-blend-screen pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 90, 0],
                        x: [-100, 100, -100],
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-accent rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1.2, 1, 1.2],
                        x: [100, -100, 100],
                        y: [-50, 50, -50],
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-purple-900 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        opacity: [0.5, 0.8, 0.5],
                        scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 15, repeat: Infinity }}
                    className="absolute top-[30%] left-[30%] w-[30vw] h-[30vw] bg-indigo-900 rounded-full blur-[100px]"
                />
            </div>

            {/* --- Main Content --- */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 text-center flex flex-col items-center">

                {/* Elite Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mb-6 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-medium tracking-wide text-foreground/80 uppercase"
                >
                    The Future of Engagement
                </motion.div>

                {/* Hero Title */}
                <motion.h1
                    className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-8"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.8 }}
                >
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
                        Intelligent Presence
                    </span>
                    <br />
                    <span className="text-stroke relative inline-block mt-2 text-foreground">
                        Redefined.
                    </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    className="max-w-2xl text-lg md:text-xl text-muted mb-12 sm:px-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 0.8 }}
                >
                    Real-time AI behavioral analysis for the modern classroom.
                    Experience seamless tracking, instant insights, and automated attendance with
                    <span className="text-accent font-semibold"> Presenza AI</span>.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                    className="flex flex-col sm:flex-row items-center gap-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                >
                    <MagneticButton>
                        <a href="/login" className="flex items-center gap-2 px-8 py-4 bg-accent text-white rounded-full font-semibold shadow-[0_0_30px_-5px_var(--color-accent)] hover:shadow-[0_0_50px_-10px_var(--color-accent)] transition-all">
                            Initialize System <ArrowRight className="w-5 h-5" />
                        </a>
                    </MagneticButton>

                    <MagneticButton>
                        <button className="flex items-center gap-2 px-8 py-4 bg-secondary/50 text-white rounded-full font-medium border border-white/5 hover:bg-secondary/80 transition-all backdrop-blur-sm">
                            <Play className="w-5 h-5 fill-current" /> Watch Demo
                        </button>
                    </MagneticButton>
                </motion.div>
            </div>

            {/* Bottom Fade */}
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </section>
    );
}
