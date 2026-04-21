"use client";

import { Hero } from "@/components/ui/Hero";
import { MonitorPlay, ShieldCheck, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-accent selection:text-background">
      {/* Floating Theme Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <Hero />

      {/* Elite Capabilities Section */}
      <section className="py-16 md:py-32 px-4 md:px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12 md:mb-20">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
                Unmatched Capabilities
            </h2>
            <p className="text-muted text-lg max-w-2xl mx-auto">
                Discover how Presenza brings clinical luxury and precision to enterprise tracking.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="glass-card p-10 group cursor-default">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--glass-bg)] text-accent border border-[var(--glass-border)] group-hover:shadow-[0_0_15px_rgba(189,244,255,0.2)] transition-shadow">
                <Users className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-foreground">Real-Time Face Recognition</h3>
            <p className="text-muted leading-relaxed">
                Instant and accurate face recognition for seamless attendance tracking, eliminating bottlenecks at entry points with surgical precision.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-card p-10 group cursor-default">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--glass-bg)] text-violet border border-[var(--glass-border)] group-hover:shadow-[0_0_15px_rgba(208,188,255,0.2)] transition-shadow">
                <MonitorPlay className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-foreground">AI Behavior Analysis</h3>
            <p className="text-muted leading-relaxed">
                Advanced AI algorithms continuously analyze behavior patterns to detect anomalies or unusual activity, functioning like a high-end sensory instrument.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-card p-10 group cursor-default">
            <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--glass-bg)] text-accent border border-[var(--glass-border)] group-hover:shadow-[0_0_15px_rgba(189,244,255,0.2)] transition-shadow">
                <ShieldCheck className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold mb-4 text-foreground">Secure Cloud Database</h3>
            <p className="text-muted leading-relaxed">
                Military-grade encryption ensures your biometric data and records are securely stored, compliant, and submerged safely in our secure architecture.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
