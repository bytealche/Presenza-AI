"use client";
import React, { useEffect, useState } from "react";
import { getAdminStats, AdminStats } from "@/services/dashboardService";

export default function AdminDashboard() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                const data = await getAdminStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to load admin stats", error);
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* Stats Cards */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.total_users}</dd>
                    </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Active Sessions</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.active_sessions}</dd>
                    </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Attendance Rate</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.attendance_rate}%</dd>
                    </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Fraud Alerts</dt>
                        <dd className="mt-1 text-3xl font-semibold text-red-600">{stats.fraud_alerts}</dd>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart Placeholders */}
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Weekly Attendance</h3>
                    <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                        [Bar Chart Placeholder]
                    </div>
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Engagement Metrics</h3>
                    <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-400">
                        [Line Chart Placeholder]
                    </div>
                </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Login Activity</h3>
                </div>
                <div className="p-4 text-sm text-gray-500">
                    (Feature coming soon: Live login logs)
                </div>
            </div>
        </div>
    );
}
