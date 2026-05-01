"use client";
import React from "react";
import { Activity, Users } from "lucide-react";

export default function EngagementPage() {
    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent via-foreground to-violet drop-shadow-md tracking-tight">
                Student Engagement
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6 border-l-4 border-l-accent">
                    <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-accent" /> Attention Span Over Time
                    </h3>
                    <div className="h-64 bg-[var(--glass-highlight)] rounded-xl flex items-center justify-center text-muted border border-[var(--glass-border)] border-dashed">
                        [Line Chart: Avg Attention Minutes]
                    </div>
                </div>

                <div className="glass-card p-6 border-l-4 border-l-violet">
                    <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-violet" /> Participation vs Attendance
                    </h3>
                    <div className="h-64 bg-[var(--glass-highlight)] rounded-xl flex items-center justify-center text-muted border border-[var(--glass-border)] border-dashed">
                        [Scatter Plot]
                    </div>
                </div>
            </div>
        </div>
    );
}
