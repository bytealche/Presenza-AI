"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getUsers, updateUserStatus } from "@/services/authService";
import { getSessions, approveSession, rejectSession, getSubjectRequests, approveSubjectRequest, rejectSubjectRequest, SubjectRequestRecord } from "@/services/sessionService";
import { User, Check, X, Clock, Shield, BarChart2, Video, Camera, BookOpen, Inbox } from "lucide-react";
import FacultyReports from "@/components/admin/FacultyReports";
import ActiveFaceEnrollment from "@/components/admin/ActiveFaceEnrollment";

export default function AdminDashboard() {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"users" | "reports" | "cameras" | "subject_requests">("users");
    const [users, setUsers] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [subjectRequests, setSubjectRequests] = useState<SubjectRequestRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingSubjectRequests, setLoadingSubjectRequests] = useState(false);
    const [enrollUser, setEnrollUser] = useState<{ id: number; name: string } | null>(null);

    useEffect(() => {
        if (user && user.role_id !== 1) {
            router.push("/dashboard"); // Will redirect to correct dashboard
        }
    }, [user, router]);

    const fetchUsers = async () => {
        try {
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const loadSessionsData = async () => {
        try {
            const data = await getSessions();
            setSessions(data);
        } catch (error) {
            console.error("Failed to load sessions", error);
        }
    };

    const fetchSubjectRequests = async () => {
        setLoadingSubjectRequests(true);
        try {
            const data = await getSubjectRequests();
            setSubjectRequests(data);
        } catch (error) {
            console.error("Failed to fetch subject requests", error);
        } finally {
            setLoadingSubjectRequests(false);
        }
    };

    useEffect(() => {
        if (user?.role_id === 1) {
            fetchUsers();
            loadSessionsData();
            fetchSubjectRequests();
        }
    }, [user]);

    const handleApproveRequest = async (sessionId: number) => {
        try {
            await approveSession(sessionId);
            await loadSessionsData();
        } catch (error) {
            console.error("Failed to approve session", error);
            alert("Failed to approve teaching request");
        }
    };

    const handleRejectRequest = async (sessionId: number) => {
        if (!confirm("Are you sure you want to reject and remove this teaching request?")) return;
        try {
            await rejectSession(sessionId);
            await loadSessionsData();
        } catch (error) {
            console.error("Failed to reject session", error);
            alert("Failed to reject teaching request");
        }
    };

    const handleApproveSubjectRequest = async (requestId: number) => {
        try {
            await approveSubjectRequest(requestId);
            await fetchSubjectRequests();
        } catch (error) {
            console.error("Failed to approve subject request", error);
            alert("Failed to approve subject request");
        }
    };

    const handleRejectSubjectRequest = async (requestId: number) => {
        if (!confirm("Are you sure you want to reject this subject catalog request?")) return;
        try {
            await rejectSubjectRequest(requestId);
            await fetchSubjectRequests();
        } catch (error) {
            console.error("Failed to reject subject request", error);
            alert("Failed to reject subject request");
        }
    };

    const handleStatusUpdate = async (userId: number, status: string) => {
        try {
            await updateUserStatus(userId, status);
            fetchUsers(); // Refresh list
        } catch (error) {
            console.error("Failed to update status", error);
            alert("Failed to update status");
        }
    };

    const userMap: Record<number, string> = {};
    users.forEach((u: any) => {
        userMap[u.user_id] = u.full_name;
    });

    return (
        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Admin Dashboard</h1>
                    <p className="text-sm sm:text-base text-muted">Manage your organization and view reports.</p>
                </div>
                <div className="bg-accent/10 p-3 rounded-lg border border-accent/20 self-start sm:self-auto">
                    <Shield className="w-6 h-6 text-accent" />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex overflow-x-auto no-scrollbar space-x-1 bg-[var(--glass-bg)] p-1 rounded-xl backdrop-blur-md border border-[var(--glass-border)] w-full sm:w-fit max-w-full">
                <button
                    onClick={() => setActiveTab("users")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "users" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-foreground"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        User Management
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab("reports")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "reports" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-foreground"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4" />
                        Faculty Reports
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab("cameras")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "cameras" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-foreground"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Video className="w-4 h-4" />
                        Cameras
                    </div>
                </button>

                <button
                    onClick={() => setActiveTab("subject_requests")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "subject_requests" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-foreground"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Inbox className="w-4 h-4" />
                        Subject Requests
                    </div>
                </button>
            </div>

            {activeTab === "users" && (
                <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-xl border border-[var(--glass-border)] overflow-hidden">
                    <div className="p-6 border-b border-[var(--glass-border)]">
                        <h2 className="text-xl font-semibold text-foreground">User Management</h2>
                    </div>

                    <div className="overflow-x-auto w-full">
                        <table className="w-full min-w-[600px] sm:min-w-full">
                            <thead className="bg-[var(--glass-highlight)]">
                                <tr>
                                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">User</th>
                                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Role</th>
                                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--glass-border)]">
                                {users.map((user) => (
                                    <tr key={user.user_id} className="hover:bg-[var(--glass-highlight)] transition-colors">
                                        <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap sm:whitespace-normal">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm sm:text-lg">
                                                    {user.full_name.charAt(0)}
                                                </div>
                                                <div className="ml-3 sm:ml-4">
                                                    <div className="text-sm font-medium text-foreground line-clamp-1">{user.full_name}</div>
                                                    <div className="text-xs sm:text-sm text-muted line-clamp-1">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                ${user.role_id === 1 ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                                                    user.role_id === 2 ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-green-500/15 text-green-600 dark:text-green-400'}`}>
                                                {user.role_id === 1 ? 'Admin' : user.role_id === 2 ? 'Faculty' : 'Student'}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                            {user.status === "pending" ? (
                                                <span className="flex items-center text-yellow-500 text-xs sm:text-sm">
                                                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Pending
                                                </span>
                                            ) : user.status === "active" ? (
                                                <span className="flex items-center text-green-500 text-xs sm:text-sm">
                                                    <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Active
                                                </span>
                                            ) : (
                                                <span className="flex items-center text-red-500 text-xs sm:text-sm">
                                                    <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Suspended
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                                            {user.status === "pending" && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleStatusUpdate(user.user_id, "active")}
                                                        className="p-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                                                        title="Approve"
                                                    >
                                                        <Check className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusUpdate(user.user_id, "suspended")}
                                                        className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                                        title="Reject"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )}
                                            {user.status === "active" && user.role_id !== 1 && (
                                                <div className="flex gap-4 items-center">
                                                    <button
                                                        onClick={() => setEnrollUser({ id: user.user_id, name: user.full_name })}
                                                        className="text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                                                    >
                                                        <Camera className="w-4 h-4" /> Enroll Face
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusUpdate(user.user_id, "suspended")}
                                                        className="text-red-400 hover:text-red-300 transition-colors"
                                                    >
                                                        Suspend
                                                    </button>
                                                </div>
                                            )}
                                            {user.status === "suspended" && (
                                                <button
                                                    onClick={() => handleStatusUpdate(user.user_id, "active")}
                                                    className="text-green-400 hover:text-green-300 transition-colors"
                                                >
                                                    Reactivate
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {users.length === 0 && !loading && (
                        <div className="p-8 text-center text-muted">
                            No users found.
                        </div>
                    )}
                </div>
            )}

            {/* Enrollment Modal */}
            {enrollUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="relative w-full max-w-2xl">
                        <button 
                            onClick={() => setEnrollUser(null)}
                            className="absolute -top-10 right-0 bg-[var(--glass-highlight)] hover:bg-[var(--glass-border)] text-foreground rounded-full p-2 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <ActiveFaceEnrollment 
                            userId={enrollUser.id} 
                            userName={enrollUser.name} 
                            onSuccess={() => {}} 
                        />
                    </div>
                </div>
            )}

            {activeTab === "reports" && <FacultyReports />}

            {activeTab === "cameras" && <ActiveCameras />}



            {activeTab === "subject_requests" && (
                <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-xl border border-[var(--glass-border)] overflow-hidden">
                    <div className="p-6 border-b border-[var(--glass-border)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">Faculty Subject Requests</h2>
                            <p className="text-xs text-muted mt-0.5">Approve or reject subject catalog entries requested by teachers.</p>
                        </div>
                        <button 
                            onClick={fetchSubjectRequests}
                            className="text-xs font-bold text-accent bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-all uppercase tracking-wide cursor-pointer"
                        >
                            Refresh List
                        </button>
                    </div>

                    <div className="overflow-x-auto w-full">
                        {loadingSubjectRequests ? (
                            <div className="p-8 text-center text-muted">Loading subject requests...</div>
                        ) : (
                            <table className="w-full min-w-[800px] sm:min-w-full">
                                <thead className="bg-[var(--glass-highlight)]">
                                    <tr className="text-muted uppercase text-[10px] font-extrabold tracking-wider bg-slate-950/20">
                                        <th className="px-6 py-4 text-left">Subject Name</th>
                                        <th className="px-6 py-4 text-left">Faculty / Creator</th>
                                        <th className="px-6 py-4 text-left">Description</th>
                                        <th className="px-6 py-4 text-left">Requested Date</th>
                                        <th className="px-6 py-4 text-left">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--glass-border)]">
                                    {subjectRequests.map((req) => {
                                        const isPending = req.status === "pending";

                                        return (
                                            <tr key={req.request_id} className="hover:bg-[var(--glass-highlight)] transition-colors">
                                                <td className="px-6 py-4.5 font-bold text-foreground">
                                                    {req.subject_name}
                                                </td>
                                                <td className="px-6 py-4.5 text-xs text-muted font-semibold">
                                                    {req.teacher_name}
                                                </td>
                                                <td className="px-6 py-4.5 text-xs text-muted max-w-[200px] truncate font-medium" title={req.description}>
                                                    {req.description || "No description provided."}
                                                </td>
                                                <td className="px-6 py-4.5 text-xs text-muted font-semibold">
                                                    {req.created_at ? new Date(req.created_at).toLocaleDateString() : "N/A"}
                                                </td>
                                                <td className="px-6 py-4.5">
                                                    {req.status === "pending" ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-1 rounded-lg tracking-wide">
                                                            <Clock className="w-3.5 h-3.5" /> Pending
                                                        </span>
                                                    ) : req.status === "approved" ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg tracking-wide">
                                                            <Check className="w-3.5 h-3.5" /> Approved
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase text-red-400 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-lg tracking-wide">
                                                            <X className="w-3.5 h-3.5" /> Rejected
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4.5 text-right text-xs font-semibold">
                                                    {isPending ? (
                                                        <div className="flex gap-2 justify-end">
                                                            <button
                                                                onClick={() => handleApproveSubjectRequest(req.request_id)}
                                                                className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/35 hover:bg-green-500/30 hover:border-green-500/50 transition-all font-bold uppercase tracking-wider text-[10px] inline-flex items-center gap-1 cursor-pointer select-none"
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectSubjectRequest(req.request_id)}
                                                                className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/35 hover:bg-red-500/30 hover:border-red-500/50 transition-all font-bold uppercase tracking-wider text-[10px] inline-flex items-center gap-1 cursor-pointer select-none"
                                                            >
                                                                <X className="w-3.5 h-3.5" /> Reject
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted text-xs">No actions required</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {subjectRequests.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-muted">
                                                No subject requests registered.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ActiveCameras() {
    const [cameras, setCameras] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // We need to import getCameras dynamically or move it here. 
        // Since we can't easily change imports in replace_file_content without creating conflicts, 
        // let's assume we can add the import at the top later or use a mix. 
        // Actually, better to just modify the file to include the component and imports properly.
        // For now, I will use a placeholder and then fix imports in next step.
        // But wait, I can just use the tool to replace the whole file or large chunk if needed.
        // Let's try to keep it simple.

        // Fetch cameras
        import("@/services/cameraService").then(({ getCameras }) => {
            getCameras().then(data => {
                setCameras(data);
                setLoading(false);
            }).catch(err => {
                console.error(err);
                setLoading(false);
            });
        });
    }, []);

    if (loading) return <div className="text-muted">Loading cameras...</div>;

    return (
        <div className="bg-[var(--glass-bg)] backdrop-blur-xl rounded-xl border border-[var(--glass-border)] overflow-hidden">
            <div className="p-6 border-b border-[var(--glass-border)] flex justify-between items-center">
                <h2 className="text-xl font-semibold text-foreground">Active Cameras</h2>
            </div>
            <div className="overflow-x-auto w-full">
                <table className="w-full min-w-[600px] sm:min-w-full">
                    <thead className="bg-[var(--glass-highlight)]">
                        <tr>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-muted uppercase">ID</th>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-muted uppercase">Location</th>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-muted uppercase">Type</th>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-muted uppercase">Status</th>
                            <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-medium text-muted uppercase">Connection URL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--glass-border)]">
                        {cameras.map((cam) => (
                            <tr key={cam.camera_id} className="hover:bg-[var(--glass-highlight)] transition-colors">
                                <td className="px-4 sm:px-6 py-3 sm:py-4 text-foreground text-xs sm:text-sm">#{cam.camera_id}</td>
                                <td className="px-4 sm:px-6 py-3 sm:py-4 text-foreground text-xs sm:text-sm">{cam.location}</td>
                                <td className="px-4 sm:px-6 py-3 sm:py-4 text-foreground text-xs sm:text-sm">{cam.camera_type}</td>
                                <td className="px-4 sm:px-6 py-3 sm:py-4">
                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${cam.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {cam.status}
                                    </span>
                                </td>
                                <td className="px-4 sm:px-6 py-3 sm:py-4 text-muted text-xs font-mono truncate max-w-[150px] sm:max-w-none">{cam.connection_url || 'N/A'}</td>
                            </tr>
                        ))}
                        {cameras.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-muted">No active cameras found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
