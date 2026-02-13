"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSessions, getSessionAttendance, Session, AttendanceRecord } from "@/services/sessionService";
import { Loader2, Calendar, User, Search, Filter } from "lucide-react";

export default function AttendancePage() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<number | null>(null);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (user) {
            loadSessions();
        }
    }, [user]);

    const loadSessions = async () => {
        if (!user) return;
        try {
            // For teachers, this returns only their sessions due to backend filtering or we pass ID
            // For students, this might return sessions they are enrolled in? 
            // Currently getSessions takes teacher_id. 
            // If we are a student, we might want "My Attendance" which is different.
            // But for this task "Restrict student records visibility for Faculty", we focus on Faculty view.

            // If Teacher (role 2):
            if (user.role_id === 2) {
                const data = await getSessions(user.user_id);
                setSessions(data);
                if (data.length > 0) {
                    // Auto select first? No, let them choose.
                }
            }
            // If Student (role 3):
            else if (user.role_id === 3) {
                // TODO: Student view logic. 
                // For now, let's just show "Select a Class" if we can fetch enrolled classes.
                // or just show "My Attendance Record" if we have that API.
                // We don't have getStudentAttendance yet.
            }
        } catch (error) {
            console.error("Failed to load sessions", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSessionChange = async (sessionId: number) => {
        setSelectedSession(sessionId);
        setLoadingAttendance(true);
        try {
            const data = await getSessionAttendance(sessionId);
            setAttendance(data);
        } catch (error) {
            console.error("Failed to load attendance", error);
            setAttendance([]);
        } finally {
            setLoadingAttendance(false);
        }
    };

    const filteredAttendance = attendance.filter(record =>
        record.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-muted">Loading...</div>;

    if (user?.role_id === 3) {
        return (
            <div className="p-8 text-center text-muted">
                <h2 className="text-xl font-semibold mb-2">My Attendance</h2>
                <p>Student attendance view is under construction.</p>
            </div>
        );
    }

    // Admin (1) or Teacher (2) view
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                    Attendance Records
                </h2>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full md:w-auto">
                    <Filter className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <select
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/50 outline-none"
                        value={selectedSession || ""}
                        onChange={(e) => handleSessionChange(Number(e.target.value))}
                    >
                        <option value="">Select a Class to View Attendance</option>
                        {sessions.map(session => (
                            <option key={session.session_id} value={session.session_id}>
                                {session.session_name} ({new Date(session.start_time).toLocaleDateString()})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search Student..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent/50 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={!selectedSession}
                    />
                </div>
            </div>

            {/* Attendance Table */}
            {selectedSession ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {loadingAttendance ? (
                        <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                            <Loader2 className="w-8 h-8 animate-spin mb-2 text-accent" />
                            Loading records...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredAttendance.map((record, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm mr-3">
                                                        {record.full_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{record.full_name}</div>
                                                        <div className="text-xs text-gray-500">{record.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 text-xs rounded-full font-medium border ${record.status === 'Present'
                                                        ? 'bg-green-50 text-green-700 border-green-100'
                                                        : record.status === 'Late'
                                                            ? 'bg-yellow-50 text-yellow-700 border-yellow-100'
                                                            : 'bg-red-50 text-red-700 border-red-100'
                                                    }`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                                                {new Date(record.timestamp).toLocaleTimeString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredAttendance.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                                                No attendance records found for this session.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Select a class above to view attendance records.</p>
                </div>
            )}
        </div>
    );
}
