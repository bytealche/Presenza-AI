"use client";

import React, { useState, useEffect } from "react";
import { 
    Activity, Users, ArrowUpRight, TrendingUp, AlertTriangle, 
    Sparkles, Mail, Calendar, MessageSquare, ChevronDown, RefreshCw, Loader2, AlertCircle 
} from "lucide-react";
import { getEngagementAnalytics } from "@/services/dashboardService";

// Types
interface DataPoint {
    label: string;
    value: number;
    percentage: number;
}

interface StudentPoint {
    name: string;
    attendance: number; // x-axis
    participation: number; // y-axis
    status: "high" | "medium" | "low";
}

interface AlertStudent {
    id: number;
    name: string;
    avatar: string;
    attendance: number;
    attention: number;
    status: string;
    trend: "up" | "down" | "stable";
    sparkline: number[];
}

export default function EngagementPage() {
    // ── Interactive States ──────────────────────────────────────────────────
    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedTimeframe, setSelectedTimeframe] = useState("Weekly");
    const [hoveredLinePoint, setHoveredLinePoint] = useState<number | null>(null);
    const [hoveredScatterPoint, setHoveredScatterPoint] = useState<number | null>(null);
    const [showReminderToast, setShowReminderToast] = useState(false);
    const [toastStudentName, setToastStudentName] = useState("");
    const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

    // ── Dynamic Dataset States ──────────────────────────────────────────────
    const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
    const [lineChartData, setLineChartData] = useState<Record<string, DataPoint[]>>({});
    const [scatterChartData, setScatterChartData] = useState<Record<string, StudentPoint[]>>({});
    const [alertStudentsData, setAlertStudentsData] = useState<Record<string, AlertStudent[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [errStatus, setErrStatus] = useState<number | null>(null);

    const timeframes = ["Weekly", "Monthly"];

    // Fetch live engagement analytics from database
    const loadEngagementData = async () => {
        try {
            setLoading(true);
            setError(null);
            setErrStatus(null);
            const data = await getEngagementAnalytics();
            setCourses(data.courses || []);
            setLineChartData(data.line_chart_data || {});
            setScatterChartData(data.scatter_chart_data || {});
            setAlertStudentsData(data.alert_students || {});
            
            if (data.courses && data.courses.length > 0) {
                setSelectedCourse(data.courses[0].id);
            } else {
                setSelectedCourse("");
            }
        } catch (err: any) {
            console.error("Failed to load engagement analytics:", err);
            const status = err.response?.status;
            setErrStatus(status || null);
            if (status === 401) {
                setError("Your login session has expired or is invalid. Please log in again to access engagement analytics.");
            } else if (status === 403) {
                setError("You do not have permission to view this page. Engagement analytics are only accessible to Faculty and Admins.");
            } else {
                setError("Failed to connect to the backend server. Please verify that the API server is online and running.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEngagementData();
    }, []);

    // ── Trigger simulated reminder ──────────────────────────────────────────
    const triggerReminder = (studentName: string, id: number) => {
        setActionLoadingId(id);
        setTimeout(() => {
            setToastStudentName(studentName);
            setShowReminderToast(true);
            setActionLoadingId(null);
            setTimeout(() => setShowReminderToast(false), 5000);
        }, 1200);
    };

    // Render loading state
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="relative flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-accent animate-spin" />
                    <div className="absolute w-12 h-12 rounded-full border border-accent/20 animate-ping"></div>
                </div>
                <p className="text-muted text-sm font-medium animate-pulse">Loading real engagement analytics...</p>
            </div>
        );
    }

    // Render error state
    if (error) {
        return (
            <div className="max-w-md mx-auto my-12 p-8 glass-card border border-red-500/20 text-center space-y-6">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-red-500/5">
                    {errStatus === 401 ? (
                        <Users className="w-8 h-8 text-red-400" />
                    ) : errStatus === 403 ? (
                        <AlertCircle className="w-8 h-8 text-red-400" />
                    ) : (
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                    )}
                </div>
                <div className="space-y-2">
                    <h3 className="text-xl font-bold text-foreground">
                        {errStatus === 401 ? "Session Expired" : errStatus === 403 ? "Access Denied" : "API Connection Error"}
                    </h3>
                    <p className="text-sm text-muted leading-relaxed">{error}</p>
                </div>
                {errStatus === 401 ? (
                    <a
                        href="/login"
                        className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-accent/25 hover:shadow-accent/40 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-2 text-sm"
                    >
                        Go to Login Page
                    </a>
                ) : errStatus === 403 ? (
                    <a
                        href="/dashboard"
                        className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-accent/25 hover:shadow-accent/40 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-2 text-sm"
                    >
                        Return to Dashboard
                    </a>
                ) : (
                    <button
                        onClick={loadEngagementData}
                        className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-accent/25 hover:shadow-accent/40 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" /> Retry Connection
                    </button>
                )}
            </div>
        );
    }

    // Render empty state if no courses exist
    if (courses.length === 0) {
        return (
            <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--glass-border)] pb-6">
                    <div>
                        <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent via-foreground to-violet drop-shadow-md tracking-tight">
                            Student Engagement Analytics
                        </h2>
                        <p className="text-muted text-sm mt-1">
                            AI-generated focus tracking, class response indices, and behavioral alerts.
                        </p>
                    </div>
                </div>

                <div className="glass-card max-w-2xl mx-auto my-12 p-10 border border-[var(--glass-border)] text-center space-y-8 relative overflow-hidden group">
                    <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-accent/5 blur-3xl group-hover:bg-accent/10 transition-all duration-700"></div>
                    <div className="absolute -left-24 -bottom-24 w-48 h-48 rounded-full bg-violet/5 blur-3xl group-hover:bg-violet/10 transition-all duration-700"></div>

                    <div className="w-20 h-20 bg-accent/10 text-accent rounded-3xl flex items-center justify-center mx-auto shadow-lg relative">
                        <div className="absolute inset-0 bg-accent/10 rounded-3xl animate-ping opacity-40"></div>
                        <Activity className="w-10 h-10 animate-pulse" />
                    </div>
                    <div className="space-y-3 max-w-md mx-auto">
                        <h3 className="text-2xl font-black text-foreground tracking-tight">No Engagement Data Found</h3>
                        <p className="text-sm text-muted leading-relaxed">
                            We couldn&apos;t find any active lecture sessions or attendance records for your account. Engagement metrics and AI-driven focus tracking will automatically populate once your classes are recorded.
                        </p>
                    </div>
                    <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                        <a
                            href="/dashboard/teacher"
                            className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-accent/25 hover:shadow-accent/40 active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-2 text-sm"
                        >
                            <Calendar className="w-4 h-4" /> Go to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const activeLineData = selectedCourse ? (lineChartData[selectedCourse] || []) : [];
    const activeScatterData = selectedCourse ? (scatterChartData[selectedCourse] || []) : [];
    const activeAlertStudents = selectedCourse ? (alertStudentsData[selectedCourse] || []) : [];

    // Helper to map SVG coordinates safely
    const getSvgLinePoints = () => {
        const width = 400;
        const height = 150;
        const paddingLeft = 40;
        const paddingTop = 20;

        return activeLineData.map((d, index) => {
            const denom = Math.max(1, activeLineData.length - 1);
            const x = paddingLeft + (index * (width / denom));
            const y = paddingTop + height - (d.percentage / 100) * height;
            return { x, y, ...d };
        });
    };

    const linePoints = getSvgLinePoints();

    // Generate SVG path description for bezier line safely
    const getBezierPath = () => {
        if (linePoints.length === 0) return "";
        let path = `M ${linePoints[0].x} ${linePoints[0].y}`;
        for (let i = 0; i < linePoints.length - 1; i++) {
            const curr = linePoints[i];
            const next = linePoints[i + 1];
            const controlX1 = curr.x + (next.x - curr.x) / 2;
            const controlY1 = curr.y;
            const controlX2 = curr.x + (next.x - curr.x) / 2;
            const controlY2 = next.y;
            path += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
        }
        return path;
    };

    // Generate area path for the gradient fill safely
    const getAreaPath = () => {
        if (linePoints.length === 0) return "";
        const linePath = getBezierPath();
        const first = linePoints[0];
        const last = linePoints[linePoints.length - 1];
        const floorY = 170; // Bottom of SVG area
        return `${linePath} L ${last.x} ${floorY} L ${first.x} ${floorY} Z`;
    };

    // Calculate aggregated course metrics dynamically with empty guards
    const avgAttention = activeLineData.length > 0
        ? Math.round(activeLineData.reduce((acc, curr) => acc + curr.percentage, 0) / activeLineData.length)
        : 0;
    const lowEngagementCount = activeScatterData.filter(s => s.status === "low").length;
    const highEngagementRatio = activeScatterData.length > 0
        ? Math.round((activeScatterData.filter(s => s.status === "high").length / activeScatterData.length) * 100)
        : 0;

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            
            {/* ── HEADER & CONTROLS ───────────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[var(--glass-border)] pb-6">
                <div>
                    <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-accent via-foreground to-violet drop-shadow-md tracking-tight">
                        Student Engagement Analytics
                    </h2>
                    <p className="text-muted text-sm mt-1">
                        AI-generated focus tracking, class response indices, and behavioral alerts.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    {/* Course Filter Dropdown */}
                    <div className="relative min-w-[220px] w-full sm:w-auto">
                        <select
                            value={selectedCourse}
                            onChange={(e) => {
                                setSelectedCourse(e.target.value);
                                setHoveredLinePoint(null);
                                setHoveredScatterPoint(null);
                            }}
                            className="w-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-foreground px-4 py-2.5 rounded-xl appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent font-medium text-sm transition-all"
                        >
                            {courses.map(c => (
                                <option key={c.id} value={c.id} className="bg-slate-900 text-foreground">{c.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-3.5 w-4 h-4 text-muted pointer-events-none" />
                    </div>

                    {/* Timeframe selector button group */}
                    <div className="flex bg-[var(--glass-bg)] border border-[var(--glass-border)] p-1 rounded-xl w-full sm:w-auto">
                        {timeframes.map((tf) => (
                            <button
                                key={tf}
                                onClick={() => setSelectedTimeframe(tf)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all uppercase ${selectedTimeframe === tf 
                                    ? "bg-accent text-white shadow-md shadow-accent/20" 
                                    : "text-muted hover:text-foreground"}`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── STATS OVERVIEW CARDS ────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Metric 1 */}
                <div className="glass-card p-6 border-l-4 border-l-accent relative overflow-hidden group hover:border-accent/40 transition-all duration-300">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-muted text-xs font-bold tracking-wider uppercase">Avg Attention Span</p>
                            <h3 className="text-3xl font-extrabold text-foreground tracking-tight mt-2">{avgAttention}%</h3>
                        </div>
                        <div className="p-3 bg-accent/10 rounded-xl text-accent group-hover:scale-110 transition-transform">
                            <Activity className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="w-full bg-[var(--glass-border)] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-accent h-full rounded-full transition-all duration-1000" style={{ width: `${avgAttention}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted font-medium">
                            <span>Sufficient Focus</span>
                            <span className="text-accent flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> Live aggregate</span>
                        </div>
                    </div>
                </div>

                {/* Metric 2 */}
                <div className="glass-card p-6 border-l-4 border-l-violet relative overflow-hidden group hover:border-violet/40 transition-all duration-300">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-muted text-xs font-bold tracking-wider uppercase">Active Participation</p>
                            <h3 className="text-3xl font-extrabold text-foreground tracking-tight mt-2">{highEngagementRatio}%</h3>
                        </div>
                        <div className="p-3 bg-violet/10 rounded-xl text-violet group-hover:scale-110 transition-transform">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="w-full bg-[var(--glass-border)] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-violet h-full rounded-full transition-all duration-1000" style={{ width: `${highEngagementRatio}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted font-medium">
                            <span>Active Students</span>
                            <span className="text-emerald-400 font-semibold">Healthy Range</span>
                        </div>
                    </div>
                </div>

                {/* Metric 3 */}
                <div className="glass-card p-6 border-l-4 border-l-blue-400 relative overflow-hidden group hover:border-blue-400/40 transition-all duration-300">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-muted text-xs font-bold tracking-wider uppercase">Tracked Students</p>
                            <h3 className="text-3xl font-extrabold text-foreground tracking-tight mt-2">{activeScatterData.length}</h3>
                        </div>
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform">
                            <Sparkles className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <p className="text-xs text-muted leading-relaxed">
                            Continuous smart biometrics processing active on current session feed.
                        </p>
                    </div>
                </div>

                {/* Metric 4 */}
                <div className="glass-card p-6 border-l-4 border-l-red-500 relative overflow-hidden group hover:border-red-500/40 transition-all duration-300">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-muted text-xs font-bold tracking-wider uppercase">Attention Alerts</p>
                            <h3 className="text-3xl font-extrabold text-red-500 tracking-tight mt-2">{lowEngagementCount}</h3>
                        </div>
                        <div className="p-3 bg-red-500/10 rounded-xl text-red-500 group-hover:scale-110 transition-transform animate-pulse">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <span className="bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                            Needs immediate intervention
                        </span>
                    </div>
                </div>
            </div>

            {/* ── INTERACTIVE SVG CHARTS GRID ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Chart 1: Line Chart */}
                <div className="glass-card p-6 border border-[var(--glass-border)] shadow-xl relative group">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <Activity className="w-5 h-5 text-accent" /> Attention Span Trend
                            </h3>
                            <p className="text-xs text-muted mt-0.5">Average focus minutes per lecture session</p>
                        </div>
                        <span className="text-[10px] text-accent font-semibold px-2 py-1 bg-accent/15 border border-accent/30 rounded-lg">LIVE METRICS</span>
                    </div>

                    <div className="relative h-64 w-full flex items-center justify-center">
                        {activeLineData.length === 0 ? (
                            <div className="text-center text-muted text-xs flex flex-col items-center gap-2 py-10">
                                <Activity className="w-8 h-8 opacity-40 animate-pulse" />
                                No lecture sessions recorded for this course.
                            </div>
                        ) : (
                            <>
                                <svg className="w-full h-full" viewBox="0 0 460 200" preserveAspectRatio="none">
                                    {/* Gradients */}
                                    <defs>
                                        <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.3" />
                                            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.0" />
                                        </linearGradient>
                                    </defs>

                                    {/* Grid Lines */}
                                    <line x1="40" y1="20" x2="440" y2="20" stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="4" />
                                    <line x1="40" y1="70" x2="440" y2="70" stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="4" />
                                    <line x1="40" y1="120" x2="440" y2="120" stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="4" />
                                    <line x1="40" y1="170" x2="440" y2="170" stroke="var(--glass-border)" strokeWidth="2" />

                                    {/* Left Y Axis Labels */}
                                    <text x="12" y="24" fill="var(--color-muted)" fontSize="9" fontWeight="bold">100%</text>
                                    <text x="16" y="74" fill="var(--color-muted)" fontSize="9" fontWeight="bold">75%</text>
                                    <text x="16" y="124" fill="var(--color-muted)" fontSize="9" fontWeight="bold">50%</text>
                                    <text x="16" y="174" fill="var(--color-muted)" fontSize="9" fontWeight="bold">0%</text>

                                    {/* Area Path */}
                                    <path d={getAreaPath()} fill="url(#line-grad)" className="transition-all duration-500" />

                                    {/* Smooth Line Path */}
                                    <path
                                        d={getBezierPath()}
                                        fill="none"
                                        stroke="var(--color-accent)"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        className="transition-all duration-500"
                                    />

                                    {/* X Axis Labels & Data Point Circles */}
                                    {linePoints.map((pt, i) => (
                                        <g key={i}>
                                            {/* X label */}
                                            <text x={pt.x} y="192" fill="var(--color-muted)" fontSize="9" fontWeight="bold" textAnchor="middle">
                                                {pt.label}
                                            </text>

                                            {/* Vertical line indicator on hover */}
                                            {hoveredLinePoint === i && (
                                                <line x1={pt.x} y1="20" x2={pt.x} y2="170" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="3" />
                                            )}

                                            {/* Active data circle */}
                                            <circle
                                                cx={pt.x}
                                                cy={pt.y}
                                                r={hoveredLinePoint === i ? 6 : 4.5}
                                                fill={hoveredLinePoint === i ? "#fff" : "var(--color-accent)"}
                                                stroke="var(--color-accent)"
                                                strokeWidth={hoveredLinePoint === i ? 3 : 1.5}
                                                className="cursor-pointer transition-all duration-200"
                                                onMouseEnter={() => setHoveredLinePoint(i)}
                                                onMouseLeave={() => setHoveredLinePoint(null)}
                                            />
                                        </g>
                                    ))}
                                </svg>

                                {/* Interactive floating html tooltip */}
                                {hoveredLinePoint !== null && linePoints[hoveredLinePoint] && (
                                    <div 
                                        className="absolute bg-slate-950/95 backdrop-blur-md border border-[var(--glass-border)] text-white px-3 py-2 rounded-lg text-xs shadow-2xl pointer-events-none z-20 flex flex-col gap-1 transition-all duration-150"
                                        style={{
                                            left: `${(linePoints[hoveredLinePoint].x / 460) * 100}%`,
                                            top: `${(linePoints[hoveredLinePoint].y / 200) * 100 - 32}%`,
                                            transform: "translate(-50%, -100%)"
                                        }}
                                    >
                                        <span className="font-extrabold text-accent text-[10px] tracking-widest uppercase">
                                            {linePoints[hoveredLinePoint].label} Focus
                                        </span>
                                        <span className="font-bold text-foreground">
                                            {linePoints[hoveredLinePoint].percentage}% Avg Attention
                                        </span>
                                        <span className="text-muted text-[10px]">
                                            ({linePoints[hoveredLinePoint].value} Focus Minutes)
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Chart 2: Scatter Plot */}
                <div className="glass-card p-6 border border-[var(--glass-border)] shadow-xl relative group">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <Users className="w-5 h-5 text-violet" /> Engagement Distribution
                            </h3>
                            <p className="text-xs text-muted mt-0.5">Participation Index vs Attendance Percentage</p>
                        </div>
                        
                        {/* Legend */}
                        <div className="flex items-center gap-3 text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> High</span>
                            <span className="flex items-center gap-1 text-yellow-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span> Mid</span>
                            <span className="flex items-center gap-1 text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Low</span>
                        </div>
                    </div>

                    <div className="relative h-64 w-full flex items-center justify-center">
                        {activeScatterData.length === 0 ? (
                            <div className="text-center text-muted text-xs flex flex-col items-center gap-2 py-10">
                                <Users className="w-8 h-8 opacity-40 animate-pulse" />
                                No students enrolled or tracked in this course.
                            </div>
                        ) : (
                            <>
                                <svg className="w-full h-full" viewBox="0 0 460 200" preserveAspectRatio="none">
                                    {/* Grid Gridlines */}
                                    <line x1="40" y1="20" x2="440" y2="20" stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="3" />
                                    <line x1="40" y1="70" x2="440" y2="70" stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="3" />
                                    <line x1="40" y1="120" x2="440" y2="120" stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="3" />
                                    <line x1="40" y1="170" x2="440" y2="170" stroke="var(--glass-border)" strokeWidth="2" />
                                    
                                    {/* Vertical grids */}
                                    <line x1="140" y1="20" x2="140" y2="170" stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="3" />
                                    <line x1="240" y1="20" x2="240" y2="170" stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="3" />
                                    <line x1="340" y1="20" x2="340" y2="170" stroke="var(--glass-border)" strokeWidth="1" strokeDasharray="3" />
                                    <line x1="440" y1="20" x2="440" y2="170" stroke="var(--glass-border)" strokeWidth="2" />

                                    {/* Axis Labels */}
                                    <text x="12" y="24" fill="var(--color-muted)" fontSize="9" fontWeight="bold">100%</text>
                                    <text x="16" y="94" fill="var(--color-muted)" fontSize="9" fontWeight="bold">50%</text>
                                    <text x="16" y="174" fill="var(--color-muted)" fontSize="9" fontWeight="bold">0%</text>

                                    <text x="40" y="186" fill="var(--color-muted)" fontSize="9" fontWeight="bold" textAnchor="middle">0%</text>
                                    <text x="240" y="186" fill="var(--color-muted)" fontSize="9" fontWeight="bold" textAnchor="middle">50% Att.</text>
                                    <text x="440" y="186" fill="var(--color-muted)" fontSize="9" fontWeight="bold" textAnchor="middle">100%</text>

                                    {/* Map scatter points */}
                                    {activeScatterData.map((pt, i) => {
                                        // Maps 0-100% to range x=(40, 440), y=(20, 170) (inverted y)
                                        const x = 40 + (pt.attendance / 100) * 400;
                                        const y = 170 - (pt.participation / 100) * 150;

                                        let nodeColor = "var(--color-accent)"; // fallback
                                        if (pt.status === "high") nodeColor = "#10b981"; // Emerald
                                        if (pt.status === "medium") nodeColor = "#f59e0b"; // Yellow/Amber
                                        if (pt.status === "low") nodeColor = "#ef4444"; // Red

                                        return (
                                            <g key={i}>
                                                {/* Background aura ring for hovered node */}
                                                {hoveredScatterPoint === i && (
                                                    <circle cx={x} cy={y} r={12} fill={nodeColor} opacity="0.25" className="animate-ping" />
                                                )}
                                                {/* Main scatter point */}
                                                <circle
                                                    cx={x}
                                                    cy={y}
                                                    r={hoveredScatterPoint === i ? 7 : 5.5}
                                                    fill={nodeColor}
                                                    stroke="var(--glass-bg)"
                                                    strokeWidth={hoveredScatterPoint === i ? 2.5 : 1.5}
                                                    className="cursor-pointer hover:scale-125 transition-transform duration-150"
                                                    onMouseEnter={() => setHoveredScatterPoint(i)}
                                                    onMouseLeave={() => setHoveredScatterPoint(null)}
                                                />
                                            </g>
                                        );
                                    })}
                                </svg>

                                {/* Interactive floating scatter tooltip */}
                                {hoveredScatterPoint !== null && activeScatterData[hoveredScatterPoint] && (
                                    (() => {
                                        const pt = activeScatterData[hoveredScatterPoint];
                                        const x = 40 + (pt.attendance / 100) * 400;
                                        const y = 170 - (pt.participation / 100) * 150;

                                        return (
                                            <div 
                                                className="absolute bg-slate-950/95 backdrop-blur-md border border-[var(--glass-border)] text-white px-3.5 py-2.5 rounded-xl text-xs shadow-2xl pointer-events-none z-20 flex flex-col gap-1 min-w-[150px] transition-all duration-150"
                                                style={{
                                                    left: `${(x / 460) * 100}%`,
                                                    top: `${(y / 200) * 100 - 32}%`,
                                                    transform: "translate(-50%, -100%)"
                                                }}
                                            >
                                                <span className="font-extrabold text-foreground text-sm border-b border-[var(--glass-border)] pb-1 mb-1">{pt.name}</span>
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-muted">Attendance:</span>
                                                    <span className="font-bold text-violet-300">{pt.attendance}%</span>
                                                </div>
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-muted">Participation:</span>
                                                    <span className="font-bold text-accent">{pt.participation}%</span>
                                                </div>
                                                <div className="mt-1 flex items-center gap-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        pt.status === "high" ? "bg-emerald-400" : pt.status === "medium" ? "bg-yellow-400" : "bg-red-400"
                                                    }`}></span>
                                                    <span className={`text-[10px] font-extrabold uppercase ${
                                                        pt.status === "high" ? "text-emerald-400" : pt.status === "medium" ? "text-yellow-400" : "text-red-400"
                                                    }`}>
                                                        {pt.status} engagement
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })()
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── LOW ENGAGEMENT ALERTS TABLE ─────────────────────────────────────── */}
            <div className="glass-card border border-[var(--glass-border)] shadow-xl overflow-hidden rounded-2xl">
                <div className="px-6 py-5 border-b border-[var(--glass-border)] bg-[var(--glass-highlight)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" /> Low Engagement Action List
                        </h3>
                        <p className="text-xs text-muted mt-0.5">Students who fell below the 60% focus index standard over consecutive lectures</p>
                    </div>
                    <span className="text-[10px] font-extrabold text-red-400 bg-red-500/15 border border-red-500/30 px-3 py-1.5 rounded-xl uppercase tracking-wider">
                        {activeAlertStudents.length} Students flagged
                    </span>
                </div>

                {activeAlertStudents.length === 0 ? (
                    <div className="py-12 text-center text-muted text-sm">
                        <Sparkles className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-50" />
                        All student engagement indices satisfy course requirements!
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--glass-border)] text-muted uppercase text-[10px] font-extrabold tracking-wider bg-slate-950/20">
                                    <th className="px-6 py-4">Student</th>
                                    <th className="px-6 py-4">Attendance Rate</th>
                                    <th className="px-6 py-4">Attention Index</th>
                                    <th className="px-6 py-4 hidden md:table-cell">Focus Trend (6 Session Window)</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--glass-border)]">
                                {activeAlertStudents.map((student) => (
                                    <tr key={student.id} className="hover:bg-slate-900/25 transition-colors group">
                                        <td className="px-6 py-4.5 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent to-purple-600 text-white font-black text-xs flex items-center justify-center shadow-md">
                                                {student.avatar}
                                            </div>
                                            <div>
                                                <div className="font-bold text-foreground text-sm group-hover:text-accent transition-colors">{student.name}</div>
                                                <div className="text-[10px] text-muted font-semibold mt-0.5 uppercase tracking-wide">ID: #0{12000 + student.id}</div>
                                            </div>
                                        </td>
                                        
                                        <td className="px-6 py-4.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-extrabold text-sm ${student.attendance < 60 ? "text-red-400" : "text-yellow-400"}`}>
                                                    {student.attendance}%
                                                </span>
                                                <span className="text-[10px] text-muted">avg</span>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4.5">
                                            <div className="flex items-center gap-3">
                                                <span className="font-extrabold text-sm text-red-400">{student.attention}%</span>
                                                <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">
                                                    CRITICAL
                                                </span>
                                            </div>
                                        </td>

                                        {/* Sparkline column */}
                                        <td className="px-6 py-4.5 hidden md:table-cell">
                                            <div className="flex items-center gap-4">
                                                {/* Custom mini SVG sparkline */}
                                                <svg className="w-24 h-6 overflow-visible" viewBox="0 0 100 30">
                                                    <polyline
                                                        fill="none"
                                                        stroke={student.status === "critical" ? "#ef4444" : "#f59e0b"}
                                                        strokeWidth="2"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        points={student.sparkline.map((val, idx) => {
                                                            const x = (idx / (student.sparkline.length - 1)) * 100;
                                                            // Map 0-100 to y=(25, 5)
                                                            const y = 25 - (val / 100) * 20;
                                                            return `${x},${y}`;
                                                        }).join(" ")}
                                                    />
                                                    {/* Glow dot on last point */}
                                                    {(() => {
                                                        const lastVal = student.sparkline[student.sparkline.length - 1];
                                                        const y = 25 - (lastVal / 100) * 20;
                                                        return <circle cx="100" cy={y} r="3" fill={student.status === "critical" ? "#ef4444" : "#f59e0b"} className="animate-pulse" />;
                                                    })()}
                                                </svg>
                                                <span className="text-[10px] text-muted font-medium italic">
                                                    Trend: {student.trend === "down" ? "Declining" : "Stable"}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4.5 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Email reminder action */}
                                                <button
                                                    onClick={() => triggerReminder(student.name, student.id)}
                                                    disabled={actionLoadingId === student.id}
                                                    className="p-2 bg-[var(--glass-highlight)] border border-[var(--glass-border)] rounded-xl text-muted hover:text-accent hover:border-accent/40 hover:bg-accent/5 disabled:opacity-50 transition-all cursor-pointer inline-flex items-center gap-1.5"
                                                    title="Send warning email"
                                                >
                                                    {actionLoadingId === student.id ? (
                                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Mail className="w-3.5 h-3.5" />
                                                    )}
                                                    <span className="hidden sm:inline text-xs font-semibold px-1">Send Notice</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── NOTIFICATION TOAST ──────────────────────────────────────────────── */}
            {showReminderToast && (
                <div className="fixed bottom-6 right-6 bg-slate-950 border border-emerald-500/40 shadow-2xl p-4 rounded-2xl z-50 flex items-start gap-3 w-full max-w-sm animate-in slide-in-from-bottom-5 duration-300">
                    <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 mt-0.5">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-bold text-sm text-foreground">Notice Dispatched</h4>
                        <p className="text-xs text-muted leading-relaxed">
                            Academic alert sent successfully to <strong className="text-white">{toastStudentName}</strong>. Tracking points synced.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
