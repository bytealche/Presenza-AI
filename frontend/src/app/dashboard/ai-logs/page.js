export default function AILogsPage() {
    const logs = [
        { id: 1, text: "Model VGG-Face loaded successfully", time: "10:00:01 AM", level: "INFO" },
        { id: 2, text: "Face detected (Confidence: 0.98)", time: "10:00:05 AM", level: "DEBUG" },
        { id: 3, text: "Embedding generated in 200ms", time: "10:00:06 AM", level: "DEBUG" },
        { id: 4, text: "User match found: ID 101", time: "10:00:06 AM", level: "SUCCESS" },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">AI Engine Logs</h2>

            <div className="bg-gray-900 text-gray-300 rounded-lg shadow overflow-hidden font-mono text-sm p-4">
                <ul className="space-y-2">
                    {logs.map((log) => (
                        <li key={log.id} className="flex">
                            <span className="text-gray-500 w-24 flex-shrink-0">[{log.time}]</span>
                            <span className={`w-16 font-bold flex-shrink-0 ${log.level === 'INFO' ? 'text-blue-400' :
                                    log.level === 'SUCCESS' ? 'text-green-400' :
                                        'text-gray-400'
                                }`}>{log.level}</span>
                            <span>{log.text}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
