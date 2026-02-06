"use client";
import React, { useEffect, useState } from "react";
import { getStudentStats, StudentStats } from "@/services/dashboardService";

export default function StudentDashboard() {
    const [stats, setStats] = useState<StudentStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadStats() {
            try {
                const data = await getStudentStats();
                setStats(data);
            } catch (error) {
                console.error("Failed to load student stats", error);
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
            <h2 className="text-2xl font-bold text-gray-800">My Dashboard</h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">My Attendance Rate</dt>
                        <dd className="mt-1 text-3xl font-semibold text-green-600">{stats.attendance_rate}%</dd>
                    </div>
                </div>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Classes Missed</dt>
                        <dd className="mt-1 text-3xl font-semibold text-red-500">{stats.classes_missed}</dd>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Attendance</h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">Your latest check-ins.</p>
                </div>
                <div className="border-t border-gray-200">
                    <dl>
                        {stats.recent_history.length === 0 ? (
                            <div className="px-4 py-5 text-gray-500">No attendance records found.</div>
                        ) : (
                            stats.recent_history.map((record, index) => (
                                <div key={record.id} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} px-4 py-5 sm:grid sm:grid-cols-4 sm:gap-4 sm:px-6`}>
                                    <dt className="text-sm font-medium text-gray-500">{record.date}</dt>
                                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-1">{record.status}</dd>
                                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-1">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {record.status}
                                        </span>
                                    </dd>
                                    <dd className="mt-1 text-sm text-gray-500 sm:mt-0 sm:col-span-1 text-right">{record.time}</dd>
                                </div>
                            ))
                        )}
                    </dl>
                </div>
            </div>
        </div>
    );
}
