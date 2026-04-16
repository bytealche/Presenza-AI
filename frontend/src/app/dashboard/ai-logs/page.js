"use client";
import React, { useEffect, useState } from "react";
import { getAILogs } from "@/services/aiLogsService";

export default function AILogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const data = await getAILogs();
                setLogs(data);
            } catch (error) {
                console.error("Failed to load AI logs", error);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-900 border border-white/10 p-6 rounded-xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                <div>
                    <h2 className="text-2xl font-bold text-white">AI Engine Logs</h2>
                    <p className="text-gray-400 mt-1">Real-time decisions and confidence matrix from the face recognition engine</p>
                </div>
            </div>

            <div className="bg-gray-900 text-gray-300 rounded-lg shadow-xl overflow-hidden text-sm p-6 border border-white/5">
                {loading ? (
                    <p className="text-gray-500 animate-pulse font-mono">Loading data feed from AI engine...</p>
                ) : logs.length === 0 ? (
                    <p className="text-gray-500 font-mono">No logs found in database.</p>
                ) : (
                    <ul className="space-y-3 font-mono">
                        {logs.map((log) => (
                            <li key={log.decision_id} className="flex flex-col sm:flex-row p-3 hover:bg-white/5 rounded transition-colors border-l-2 border-transparent hover:border-blue-500">
                                <span className="text-gray-500 w-32 flex-shrink-0">
                                    {new Date(log.created_at).toLocaleTimeString()}
                                </span>
                                <span className={`w-24 font-bold flex-shrink-0 ${
                                    log.final_status === 'present' ? 'text-green-400' :
                                    log.final_status === 'fraud' ? 'text-red-400' :
                                    'text-blue-400'
                                }`}>
                                    [{log.final_status.toUpperCase()}]
                                </span>
                                <span className="flex-1 text-gray-300">
                                    <span className="text-white font-semibold">{log.user_name}</span> detected via <span className="text-gray-400">{log.model_name}</span> 
                                    <span className={log.confidence_score > 0.8 ? 'text-green-300 ml-2' : 'text-yellow-300 ml-2'}>
                                        (Conf: {(log.confidence_score * 100).toFixed(1)}%)
                                    </span>
                                    <span className="text-gray-500 ml-2">— {log.decision_reason}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
