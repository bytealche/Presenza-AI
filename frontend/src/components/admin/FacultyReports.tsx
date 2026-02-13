"use client";
import React, { useState, useEffect } from "react";
import { User, Calendar, Users, ChevronRight, ArrowLeft, Mail, Clock, MapPin } from "lucide-react";
import { getUsers } from "@/services/authService";
import { getSessions, getSessionAttendance, Session, AttendanceRecord } from "@/services/sessionService";

interface FacultyMember {
    user_id: number;
    full_name: string;
    email: string;
    role_id: number;
}

export default function FacultyReports() {
    // State for navigation
    const [view, setView] = useState<"list" | "classes" | "attendance">("list");

    // Data State
    const [faculty, setFaculty] = useState<FacultyMember[]>([]);
    const [selectedFaculty, setSelectedFaculty] = useState<FacultyMember | null>(null);

    const [classes, setClasses] = useState<Session[]>([]);
    const [selectedClass, setSelectedClass] = useState<Session | null>(null);

    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // Initial Load - List Faculty
    useEffect(() => {
        loadFaculty();
    }, []);

    const loadFaculty = async () => {
        setLoading(true);
        try {
            const data = await getUsers(2); // Role ID 2 = Faculty
            setFaculty(data);
        } catch (error) {
            console.error("Failed to load faculty", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectFaculty = async (user: FacultyMember) => {
        setSelectedFaculty(user);
        setLoading(true);
        try {
            const data = await getSessions(user.user_id);
            setClasses(data);
            setView("classes");
        } catch (error) {
            console.error("Failed to load classes", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectClass = async (session: Session) => {
        setSelectedClass(session);
        setLoading(true);
        try {
            const data = await getSessionAttendance(session.session_id);
            setAttendance(data);
            setView("attendance");
        } catch (error) {
            console.error("Failed to load attendance", error);
        } finally {
            setLoading(false);
        }
    };

    const goBack = () => {
        if (view === "attendance") {
            setView("classes");
            setSelectedClass(null);
            setAttendance([]);
        } else if (view === "classes") {
            setView("list");
            setSelectedFaculty(null);
            setClasses([]);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    {view !== "list" && (
                        <button onClick={goBack} className="mr-2 p-1 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    {view === "list" && "Faculty Reports"}
                    {view === "classes" && `Classes by ${selectedFaculty?.full_name}`}
                    {view === "attendance" && `Attendance for ${selectedClass?.session_name}`}
                </h2>
            </div>

            {loading && <div className="text-muted">Loading...</div>}

            {!loading && view === "list" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {faculty.map((user) => (
                        <div
                            key={user.user_id}
                            onClick={() => handleSelectFaculty(user)}
                            className="bg-secondary/30 border border-white/5 p-4 rounded-xl cursor-pointer hover:bg-white/5 transition-all group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                                    {user.full_name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">{user.full_name}</h3>
                                    <p className="text-sm text-muted flex items-center gap-1">
                                        <Mail className="w-3 h-3" /> {user.email}
                                    </p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted group-hover:text-white" />
                            </div>
                        </div>
                    ))}
                    {faculty.length === 0 && <div className="col-span-full text-muted">No faculty members found.</div>}
                </div>
            )}

            {!loading && view === "classes" && (
                <div className="space-y-4">
                    {classes.map((cls) => (
                        <div
                            key={cls.session_id}
                            onClick={() => handleSelectClass(cls)}
                            className="bg-secondary/30 border border-white/5 p-4 rounded-xl cursor-pointer hover:bg-white/5 transition-all flex items-center justify-between group"
                        >
                            <div>
                                <h3 className="font-semibold text-white text-lg group-hover:text-blue-400 transition-colors">{cls.session_name}</h3>
                                <div className="flex gap-4 text-sm text-muted mt-1">
                                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {new Date(cls.start_time).toLocaleString()}</span>
                                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {cls.location}</span>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted group-hover:text-white" />
                        </div>
                    ))}
                    {classes.length === 0 && (
                        <div className="text-center p-8 text-muted bg-white/5 rounded-xl border border-white/5 border-dashed">
                            No classes found for this faculty member.
                        </div>
                    )}
                </div>
            )}

            {!loading && view === "attendance" && (
                <div className="bg-secondary/30 border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-black/20">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Student</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-medium text-muted uppercase">Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {attendance.map((record, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-white mr-3">
                                                {record.full_name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">{record.full_name}</div>
                                                <div className="text-xs text-muted">{record.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${record.status === 'Present'
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            }`}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-muted">
                                        {new Date(record.timestamp).toLocaleTimeString()}
                                    </td>
                                </tr>
                            ))}
                            {attendance.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-8 text-center text-muted">No attendance records found for this class.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
