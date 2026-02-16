"use client";
import React, { useEffect, useState } from "react";
import { getStudentStats, StudentStats } from "@/services/dashboardService";
import { getSessions, Session } from "@/services/sessionService";
import { Clock, MapPin, Video, LogIn, Calendar } from "lucide-react";

export default function StudentDashboard() {
    const [stats, setStats] = useState<StudentStats | null>(null);
    const [classes, setClasses] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [statsData, classesData] = await Promise.all([
                getStudentStats(),
                getSessions()
            ]);
            setStats(statsData);
            setClasses(classesData);
        } catch (error) {
            console.error("Failed to load student dashboard data", error);
        } finally {
            setLoading(false);
        }
    }

    const isActive = (cls: Session) => {
        const now = new Date();
        const start = new Date(cls.start_time);
        const end = new Date(cls.end_time);
        return now >= start && now <= end;
    };

    const isUpcoming = (cls: Session) => {
        const now = new Date();
        const start = new Date(cls.start_time);
        return start > now;
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;

    // Sort classes: Active first, then upcoming by date
    const activeClasses = classes.filter(isActive);
    const upcomingClasses = classes.filter(isUpcoming).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-white">
                Student Dashboard
            </h2>

            {/* Active Classes Section */}
            {activeClasses.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        Live Now
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeClasses.map((cls) => (
                            <div key={cls.session_id} className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-xl shadow-md border border-green-500/20 p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Video className="w-24 h-24 text-green-400" />
                                </div>
                                <div className="relative z-10">
                                    <h4 className="text-2xl font-bold text-white mb-2">{cls.session_name}</h4>
                                    <div className="space-y-2 text-sm text-gray-300 mb-6">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-green-400" />
                                            <span>
                                                {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(cls.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-green-400" />
                                            <span>{cls.location || "Online"}</span>
                                        </div>
                                    </div>
                                    <button className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]">
                                        <LogIn className="w-5 h-5" />
                                        Join Class
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Stats Overview */}
            {stats && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="bg-secondary/30 backdrop-blur-md overflow-hidden shadow-sm rounded-xl border border-white/10 p-6">
                        <dt className="text-sm font-medium text-gray-400 truncate">My Attendance Rate</dt>
                        <dd className="mt-2 text-3xl font-bold text-green-400">{stats.attendance_rate}%</dd>
                    </div>
                    <div className="bg-secondary/30 backdrop-blur-md overflow-hidden shadow-sm rounded-xl border border-white/10 p-6">
                        <dt className="text-sm font-medium text-gray-400 truncate">Classes Missed</dt>
                        <dd className="mt-2 text-3xl font-bold text-red-400">{stats.classes_missed}</dd>
                    </div>
                </div>
            )}

            {/* Upcoming Classes */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white">Upcoming Classes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcomingClasses.map((cls) => (
                        <div key={cls.session_id} className="bg-secondary/30 backdrop-blur-md rounded-xl shadow-sm border border-white/10 p-6 hover:shadow-md transition-shadow hover:border-accent/30">
                            <h4 className="text-lg font-bold text-white mb-2">{cls.session_name}</h4>
                            <div className="space-y-2 text-sm text-gray-300">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <span>{new Date(cls.start_time).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    <span>
                                        {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-gray-500" />
                                    <span>{cls.location || "Online"}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {upcomingClasses.length === 0 && (
                        <div className="col-span-full py-8 text-center text-gray-400 bg-white/5 rounded-xl border border-white/10">
                            No upcoming classes scheduled.
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Attendance (Existing) */}
            {stats && (
                <div className="bg-secondary/30 backdrop-blur-md shadow-sm border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-white/10 bg-white/5">
                        <h3 className="text-lg leading-6 font-semibold text-white">Recent History</h3>
                    </div>
                    <div className="divide-y divide-white/10">
                        {stats.recent_history.length === 0 ? (
                            <div className="px-6 py-8 text-center text-gray-400">No attendance records found.</div>
                        ) : (
                            stats.recent_history.map((record) => (
                                <div key={record.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-white">{record.date}</span>
                                        <span className="text-xs text-gray-400">{record.time}</span>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${record.status === 'Present'
                                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>
                                        {record.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
