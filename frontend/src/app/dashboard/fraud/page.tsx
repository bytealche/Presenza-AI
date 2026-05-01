"use client";
import React from "react";
import { ShieldAlert, AlertTriangle } from "lucide-react";

export default function FraudPage() {
    const alerts = [
        { id: 1, type: "Spoofing Attempt", user: "Unknown", time: "10:30 AM", risk: "High", details: "Photo of a photo detected" },
        { id: 2, type: "Multiple Faces", user: "John Doe", time: "09:15 AM", risk: "Medium", details: "3 faces detected in frame" },
        { id: 3, type: "Location Mismatch", user: "Jane Smith", time: "08:45 AM", risk: "Low", details: "Login from new IP" },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent via-foreground to-violet drop-shadow-md tracking-tight">
                Fraud Detection Logs
            </h2>

            <div className="glass-card overflow-hidden">
                <ul className="divide-y divide-[var(--glass-border)]">
                    {alerts.map((alert) => (
                        <li key={alert.id}>
                            <div className="px-4 py-4 sm:px-6 hover:bg-[var(--glass-highlight)] transition-colors">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-accent truncate flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        {alert.type}
                                    </p>
                                    <div className="ml-2 flex-shrink-0 flex">
                                        <p className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${alert.risk === 'High' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                alert.risk === 'Medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                    'bg-green-500/20 text-green-400 border border-green-500/30'
                                            }`}>
                                            {alert.risk} Risk
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-2 sm:flex sm:justify-between">
                                    <div className="sm:flex">
                                        <p className="flex items-center text-sm text-foreground mr-6">
                                            User: {alert.user}
                                        </p>
                                        <p className="flex items-center text-sm text-muted-bright">
                                            Details: {alert.details}
                                        </p>
                                    </div>
                                    <div className="mt-2 flex items-center text-sm text-muted sm:mt-0">
                                        <p>{alert.time}</p>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
