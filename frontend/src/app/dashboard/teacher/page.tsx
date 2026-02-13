"use client";
import React, { useEffect, useState } from "react";
import { getTeacherStats, TeacherStats } from "@/services/dashboardService";
import { getSessions, createSession, Session } from "@/services/sessionService";
import { getCameras, Camera } from "@/services/cameraService";
import { Plus, Calendar, MapPin, Video, Clock, X, Loader2 } from "lucide-react";

export default function TeacherDashboard() {
    const [stats, setStats] = useState<TeacherStats | null>(null);
    const [classes, setClasses] = useState<Session[]>([]);
    const [cameras, setCameras] = useState<Camera[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);

    // Form State
    const [newClass, setNewClass] = useState({
        session_name: "",
        start_time: "",
        end_time: "",
        location: "",
        camera_id: ""
    });

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            const [statsData, classesData, camerasData] = await Promise.all([
                getTeacherStats(),
                getSessions(),
                getCameras()
            ]);
            setStats(statsData);
            setClasses(classesData);
            setCameras(camerasData);
        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            setLoading(false);
        }
    }

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await createSession({
                ...newClass,
                camera_id: newClass.camera_id ? Number(newClass.camera_id) : undefined
            });
            await loadData(); // Refresh list
            setIsModalOpen(false);
            setNewClass({ session_name: "", start_time: "", end_time: "", location: "", camera_id: "" });
        } catch (error: any) {
            console.error("Failed to create class", error);
            const msg = error.response?.data?.detail || "Failed to create class. Please check fields.";
            alert(`Error: ${msg}`);
        } finally {
            setCreating(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                    Teacher Dashboard
                </h2>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-accent/20"
                >
                    <Plus className="w-4 h-4" />
                    Create Class
                </button>
            </div>

            {/* Stats Row */}
            {stats && (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                    <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Classes</dt>
                        <dd className="mt-2 text-3xl font-bold text-gray-900">{stats.total_classes}</dd>
                    </div>
                    <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Avg. Attendance</dt>
                        <dd className="mt-2 text-3xl font-bold text-gray-900">{stats.avg_attendance}%</dd>
                    </div>
                    <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Low Engagement Alerts</dt>
                        <dd className="mt-2 text-3xl font-bold text-yellow-600">{stats.low_engagement}</dd>
                    </div>
                </div>
            )}

            {/* Classes List */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-800">My Classes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {classes.map((cls) => (
                        <div key={cls.session_id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="text-lg font-bold text-gray-900">{cls.session_name}</h4>
                                <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-100">
                                    {new Date(cls.start_time) > new Date() ? "Scheduled" : "Active/Past"}
                                </span>
                            </div>

                            <div className="space-y-2 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    <span>{new Date(cls.start_time).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <span>{new Date(cls.start_time).toLocaleTimeString()} - {new Date(cls.end_time).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    <span>{cls.location || "Online"}</span>
                                </div>
                                {cls.camera_id && (
                                    <div className="flex items-center gap-2">
                                        <Video className="w-4 h-4 text-gray-400" />
                                        <span>Camera ID: {cls.camera_id}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {classes.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <p className="text-gray-500">No classes found. Create one to get started.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Class Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-2xl font-bold text-gray-900 mb-6">Create New Class</h3>

                        <form onSubmit={handleCreateClass} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                                    placeholder="e.g. CS101 - Intro to AI"
                                    value={newClass.session_name}
                                    onChange={(e) => setNewClass({ ...newClass, session_name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                                        value={newClass.start_time}
                                        onChange={(e) => setNewClass({ ...newClass, start_time: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                                        value={newClass.end_time}
                                        onChange={(e) => setNewClass({ ...newClass, end_time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                                    placeholder="e.g. Room 304 or Zoom Link"
                                    value={newClass.location}
                                    onChange={(e) => setNewClass({ ...newClass, location: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Camera (Optional)</label>
                                <select
                                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-accent/50 focus:border-accent outline-none transition-all"
                                    value={newClass.camera_id}
                                    onChange={(e) => setNewClass({ ...newClass, camera_id: e.target.value })}
                                >
                                    <option value="">Select a camera</option>
                                    {cameras.map(cam => (
                                        <option key={cam.camera_id} value={cam.camera_id}>
                                            {cam.location} - {cam.description || cam.camera_type} {cam.connection_url ? `(${cam.connection_url})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Select a camera to associate with this class. If you see a localhost URL, ensure it is accessible from the server.
                                </p>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-3 rounded-lg transition-all flex justify-center items-center gap-2"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        "Create Class"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
