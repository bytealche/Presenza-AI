"use client";

import Link from "next/link";
import { User, Building, Users, ArrowRight } from "lucide-react";

export default function RegisterSelectionPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-4xl w-full space-y-8 relative z-10">
                <div className="text-center">
                    <h2 className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Join Presenza AI
                    </h2>
                    <p className="mt-4 text-lg text-muted">
                        Select your role to get started with next-gen attendance tracking.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
                    {/* Organization Card */}
                    <Link href="/register/organization" className="group">
                        <div className="h-full bg-secondary/30 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl hover:border-accent/50 hover:shadow-accent/20 transition-all duration-300 transform hover:-translate-y-1">
                            <div className="w-14 h-14 bg-gradient-to-br from-accent to-purple-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-accent/20 group-hover:scale-110 transition-transform">
                                <Building className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Organization</h3>
                            <p className="text-muted text-sm mb-6">
                                Register your university or company. Manage faculty, students, and attendance analytics.
                            </p>
                            <div className="flex items-center text-accent text-sm font-medium group-hover:translate-x-1 transition-transform">
                                Register Now <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                        </div>
                    </Link>

                    {/* Faculty Card */}
                    <Link href="/register/faculty" className="group">
                        <div className="h-full bg-secondary/30 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl hover:border-accent/50 hover:shadow-accent/20 transition-all duration-300 transform hover:-translate-y-1">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                                <Users className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Faculty</h3>
                            <p className="text-muted text-sm mb-6">
                                Join an organization as a teacher. Create classes, track attendance, and manage student performance.
                            </p>
                            <div className="flex items-center text-blue-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                                Register Now <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                        </div>
                    </Link>

                    {/* Student Card */}
                    <Link href="/register/student" className="group">
                        <div className="h-full bg-secondary/30 backdrop-blur-xl p-8 rounded-2xl border border-white/5 shadow-2xl hover:border-accent/50 hover:shadow-accent/20 transition-all duration-300 transform hover:-translate-y-1">
                            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                                <User className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Student</h3>
                            <p className="text-muted text-sm mb-6">
                                Register as a student. View your attendance records, course materials, and engagement stats.
                            </p>
                            <div className="flex items-center text-emerald-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                                Register Now <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                        </div>
                    </Link>
                </div>

                <div className="text-center mt-8">
                    <p className="text-muted text-sm">
                        Already have an account?{" "}
                        <Link href="/login" className="font-medium text-accent hover:text-accent/80 transition-colors">
                            Login here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
