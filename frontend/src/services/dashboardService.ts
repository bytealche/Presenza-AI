import api from "./api";

export interface AdminStats {
    total_users: number;
    active_sessions: number;
    attendance_rate: number;
    fraud_alerts: number;
}

export interface TeacherStats {
    total_classes: number;
    avg_attendance: number;
    low_engagement: number;
}

export interface StudentStats {
    attendance_rate: number;
    classes_missed: number;
    recent_history: {
        id: number;
        date: string;
        status: string;
        time: string;
        timestamp?: string;
    }[];
}

export const getAdminStats = async (): Promise<AdminStats> => {
    const res = await api.get<AdminStats>("/analytics/admin/stats");
    return res.data;
};

export const getTeacherStats = async (): Promise<TeacherStats> => {
    const res = await api.get<TeacherStats>("/analytics/teacher/stats");
    return res.data;
};

export const getStudentStats = async (): Promise<StudentStats> => {
    const res = await api.get<StudentStats>("/analytics/student/stats");
    return res.data;
};

export interface EngagementData {
    courses: { id: string; name: string }[];
    line_chart_data: Record<string, { label: string; value: number; percentage: number }[]>;
    scatter_chart_data: Record<string, { name: string; attendance: number; participation: number; status: "high" | "medium" | "low" }[]>;
    alert_students: Record<string, { id: number; name: string; avatar: string; attendance: number; attention: number; status: "critical" | "warning"; trend: "up" | "down" | "stable"; sparkline: number[] }[]>;
}

export const getEngagementAnalytics = async (): Promise<EngagementData> => {
    const res = await api.get<EngagementData>("/analytics/engagement");
    return res.data;
};
