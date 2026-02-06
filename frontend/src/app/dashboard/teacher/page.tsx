"use client";
import React, { useEffect, useState } from "react";
import { getTeacherStats, TeacherStats } from "@/services/dashboardService";

export default function TeacherDashboard() {
    const [stats, setStats] = useState<TeacherStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                const data = await getTeacherStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to load teacher stats", error);
            } finally {
                setLoading(false);
            }
        }
        loadStats();
    }, []);

    if (loading) return <div>Loading dashboard...</div>;
    if (!stats) return <div>Failed to load data.</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Teacher Dashboard</h2>

            {/* Stats Row */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Classes</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.total_classes}</dd>
                    </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Avg. Attendance</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.avg_attendance}%</dd>
                    </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Low Engagement Alerts</dt>
                        <dd className="mt-1 text-3xl font-semibold text-yellow-600">{stats.low_engagement}</dd>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Class Engagement Trends</h3>
                <div className="h-64 bg-gray-50 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-500">
                    [Engagement Line Chart Placeholder]
                </div>
            </div>
        </div>
    );
}
