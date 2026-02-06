"use client";

import { Hero } from "@/components/ui/Hero";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-accent selection:text-white">
      <Hero />

      {/* Scroll Reveal Section (Placeholders for now) */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Features will go here */}
        </div>
      </section>
    </main>
  );
}
