"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSessions, getSessionAttendance, Session, AttendanceRecord } from "@/services/sessionService";
import { Loader2, Calendar, Search, Filter, RefreshCw, ShieldAlert, CheckCircle, Clock, XCircle, AlertTriangle } from "lucide-react";

export default function AttendancePage() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<number | null>(null);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    useEffect(() => {
        if (user) loadSessions();
    }, [user]);

    // Auto-refresh every 10 seconds when enabled
    useEffect(() => {
        if (!autoRefresh || !selectedSession) return;
        const interval = setInterval(() => refreshAttendance(selectedSession), 10000);
        return () => clearInterval(interval);
    }, [autoRefresh, selectedSession]);

    const loadSessions = async () => {
        if (!user) return;
        try {
            let data: Session[] = [];
            if (user.role_id === 2) {
                data = await getSessions(user.user_id);
            } else if (user.role_id === 1) {
                data = await getSessions();
            }
            setSessions(data);

            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                const initialSessionId = params.get("sessionId");
                if (initialSessionId) {
                    const sId = parseInt(initialSessionId, 10);
                    if (data.some(s => s.session_id === sId)) {
                        handleSessionChange(sId);
                        const session = data.find(s => s.session_id === sId);
                        if (session) {
                            setSelectedDate(session.start_time ? new Date(session.start_time).toLocaleDateString() : "Unknown Date");
                        }
                    }
                } else if (data.length > 0) {
                    // Try to group and select the most recent date
                    const dates = data.map(s => s.start_time ? new Date(s.start_time).toLocaleDateString() : "Unknown Date");
                    const uniqueDates = Array.from(new Set(dates));
                    if (uniqueDates.length > 0) setSelectedDate(uniqueDates[0]);
                }
            }
        } catch (error) {
            console.error("Failed to load sessions", error);
        } finally {
            setLoading(false);
        }
    };

    const refreshAttendance = useCallback(async (sessionId: number) => {
        try {
            const data = await getSessionAttendance(sessionId);
            setAttendance(data);
            setLastRefreshed(new Date());
        } catch (error) {
            console.error("Failed to refresh attendance", error);
        }
    }, []);

    const handleSessionChange = async (sessionId: number) => {
        setSelectedSession(sessionId);
        setLoadingAttendance(true);
        try {
            const data = await getSessionAttendance(sessionId);
            setAttendance(data);
            setLastRefreshed(new Date());
        } catch (error) {
            console.error("Failed to load attendance", error);
            setAttendance([]);
        } finally {
            setLoadingAttendance(false);
        }
    };

    const filteredAttendance = attendance.filter(record =>
        record.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Counts
    const presentCount = attendance.filter(r => r.status?.toLowerCase() === "present").length;
    const fraudCount = attendance.filter(r => r.status?.toLowerCase() === "fraud").length;
    const totalCount = attendance.length;

    const groupedSessions = sessions.reduce((acc, session) => {
        const dateStr = session.start_time ? new Date(session.start_time).toLocaleDateString() : "Unknown Date";
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(session);
        return acc;
    }, {} as Record<string, Session[]>);

    const sortedDates = Object.keys(groupedSessions).sort((a, b) => {
        if (a === "Unknown Date") return 1;
        if (b === "Unknown Date") return -1;
        return new Date(b).getTime() - new Date(a).getTime();
    });

    // Student view
    if (user?.role_id === 3) {
        return (
            <div className="p-8 text-center text-muted">
                <h2 className="text-xl font-semibold mb-2">My Attendance</h2>
                <p>Student attendance view is under construction.</p>
            </div>
        );
    }

    if (loading) return <div className="p-8 text-center text-muted flex items-center gap-2 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Attendance Records</h2>
                    <p className="text-muted text-sm mt-1">AI-powered live attendance tracking</p>
                </div>
                {selectedSession && (
                    <div className="flex items-center gap-3">
                        {lastRefreshed && (
                            <span className="text-xs text-muted">
                                Updated {lastRefreshed.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={() => selectedSession && refreshAttendance(selectedSession)}
                            className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" /> Refresh
                        </button>
                        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                            <div className={`w-9 h-5 rounded-full transition-colors ${autoRefresh ? "bg-accent" : "bg-[var(--glass-border)]"} relative`}
                                onClick={() => setAutoRefresh(p => !p)}>
                                <div className={`absolute top-0.5 w-4 h-4 bg-background rounded-full shadow transition-all ${autoRefresh ? "left-4" : "left-0.5"}`} />
                            </div>
                            <span className="text-muted">Auto</span>
                        </label>
                    </div>
                )}
            </div>

            {/* Summary badges */}
            {selectedSession && attendance.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-green-400" />
                        <div>
                            <p className="text-xs text-muted">Present</p>
                            <p className="text-2xl font-bold text-green-400">{presentCount}</p>
                        </div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                        <ShieldAlert className="w-6 h-6 text-red-400" />
                        <div>
                            <p className="text-xs text-muted">Spoofing / Fraud</p>
                            <p className="text-2xl font-bold text-red-400">{fraudCount}</p>
                        </div>
                    </div>
                    <div className="bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-xl p-4 flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-muted" />
                        <div>
                            <p className="text-xs text-muted">Total Detected</p>
                            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-xl p-4 flex flex-col gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 snap-x">
                    {sortedDates.map(date => (
                        <button
                            key={date}
                            onClick={() => {
                                setSelectedDate(date);
                                setSelectedSession(null);
                                setAttendance([]);
                            }}
                            className={`shrink-0 px-4 py-2 rounded-lg border transition-all snap-start font-medium text-sm ${selectedDate === date ? 'bg-accent/20 border-accent text-accent' : 'bg-[var(--glass-highlight)] border-[var(--glass-border)] text-muted-bright hover:border-accent/50'}`}
                        >
                            📅 {date}
                        </button>
                    ))}
                    {sortedDates.length === 0 && <span className="text-muted text-sm">No classes scheduled yet.</span>}
                </div>
                
                {selectedDate && groupedSessions[selectedDate] && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--glass-border)]">
                        {groupedSessions[selectedDate].map(session => (
                            <button
                                key={session.session_id}
                                onClick={() => handleSessionChange(session.session_id)}
                                className={`px-4 py-2 rounded-lg border text-sm transition-all font-medium ${selectedSession === session.session_id ? 'bg-accent text-black border-accent' : 'bg-[var(--glass-highlight)] border-[var(--glass-border)] text-foreground hover:bg-white/10'}`}
                            >
                                {session.session_name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="relative w-full mt-2">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-muted" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        className="w-full pl-10 pr-4 py-2 bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-lg text-foreground placeholder-muted focus:ring-2 focus:ring-accent/50 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={!selectedSession}
                    />
                </div>
            </div>

            {/* Table */}
            {selectedSession ? (
                <div className="bg-[var(--glass-bg)] backdrop-blur-md rounded-xl border border-[var(--glass-border)] overflow-hidden">
                    {loadingAttendance ? (
                        <div className="p-12 text-center text-muted flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-accent" />
                            Loading records...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-[var(--glass-highlight)]">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase">Student</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted uppercase">Detected At</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--glass-border)]">
                                    {filteredAttendance.map((record, idx) => {
                                        const statusLower = record.status?.toLowerCase();
                                        const isFraud = statusLower === "fraud";
                                        const isPresent = statusLower === "present";
                                        const isLate = statusLower === "late";

                                        return (
                                            <tr key={idx} className={`transition-colors ${isFraud ? "bg-red-500/5 hover:bg-red-500/10" : "hover:bg-[var(--glass-highlight)]"}`}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${isFraud ? "bg-gradient-to-br from-red-500 to-orange-600" : "bg-gradient-to-br from-indigo-500 to-purple-600"}`}>
                                                            {record.full_name?.charAt(0) ?? "?"}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-foreground">{record.full_name}</div>
                                                            <div className="text-xs text-muted">{record.email}</div>
                                                        </div>
                                                        {isFraud && (
                                                            <span className="ml-auto flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                                                                <AlertTriangle className="w-3 h-3" /> Spoofing Detected
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isFraud ? (
                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full w-fit">
                                                            <ShieldAlert className="w-3.5 h-3.5" /> FRAUD
                                                        </span>
                                                    ) : isPresent ? (
                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/30 px-2.5 py-1 rounded-full w-fit">
                                                            <CheckCircle className="w-3.5 h-3.5" /> Present
                                                        </span>
                                                    ) : isLate ? (
                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-1 rounded-full w-fit">
                                                            <Clock className="w-3.5 h-3.5" /> Late
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full w-fit">
                                                            <XCircle className="w-3.5 h-3.5" /> Absent
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-muted font-mono">
                                                    {record.timestamp ? new Date(record.timestamp).toLocaleTimeString() : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredAttendance.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-16 text-center text-muted">
                                                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                                No attendance records found yet. Start streaming to auto-detect attendance.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-20 bg-[var(--glass-bg)] rounded-xl border border-[var(--glass-border)] border-dashed">
                    <Calendar className="w-12 h-12 text-muted mx-auto mb-3 opacity-30" />
                    <p className="text-muted">Select a class above to view AI-detected attendance records.</p>
                </div>
            )}
        </div>
    );
}
