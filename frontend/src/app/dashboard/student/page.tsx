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
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                Student Dashboard
            </h2>

            {/* Active Classes Section */}
            {activeClasses.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        Live Now
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeClasses.map((cls) => (
                            <div key={cls.session_id} className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-md border border-green-100 p-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Video className="w-24 h-24 text-green-600" />
                                </div>
                                <div className="relative z-10">
                                    <h4 className="text-2xl font-bold text-gray-900 mb-2">{cls.session_name}</h4>
                                    <div className="space-y-2 text-sm text-gray-700 mb-6">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-green-600" />
                                            <span>
                                                {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(cls.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-4 h-4 text-green-600" />
                                            <span>{cls.location || "Online"}</span>
                                        </div>
                                    </div>
                                    <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]">
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
                    <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">My Attendance Rate</dt>
                        <dd className="mt-2 text-3xl font-bold text-green-600">{stats.attendance_rate}%</dd>
                    </div>
                    <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Classes Missed</dt>
                        <dd className="mt-2 text-3xl font-bold text-red-500">{stats.classes_missed}</dd>
                    </div>
                </div>
            )}

            {/* Upcoming Classes */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">Upcoming Classes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcomingClasses.map((cls) => (
                        <div key={cls.session_id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <h4 className="text-lg font-bold text-gray-900 mb-2">{cls.session_name}</h4>
                            <div className="space-y-2 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span>{new Date(cls.start_time).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span>
                                        {new Date(cls.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    <span>{cls.location || "Online"}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {upcomingClasses.length === 0 && (
                        <div className="col-span-full py-8 text-center text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                            No upcoming classes scheduled.
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Attendance (Existing) */}
            {stats && (
                <div className="bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                        <h3 className="text-lg leading-6 font-semibold text-gray-900">Recent History</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {stats.recent_history.length === 0 ? (
                            <div className="px-6 py-8 text-center text-gray-500">No attendance records found.</div>
                        ) : (
                            stats.recent_history.map((record) => (
                                <div key={record.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900">{record.date}</span>
                                        <span className="text-xs text-gray-500">{record.time}</span>
                                    </div>
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${record.status === 'Present'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-red-50 text-red-700 border-red-200'
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
