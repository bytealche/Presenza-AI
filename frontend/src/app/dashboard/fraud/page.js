export default function FraudPage() {
    const alerts = [
        { id: 1, type: "Spoofing Attempt", user: "Unknown", time: "10:30 AM", risk: "High", details: "Photo of a photo detected" },
        { id: 2, type: "Multiple Faces", user: "John Doe", time: "09:15 AM", risk: "Medium", details: "3 faces detected in frame" },
        { id: 3, type: "Location Mismatch", user: "Jane Smith", time: "08:45 AM", risk: "Low", details: "Login from new IP" },
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Fraud Detection Logs</h2>

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {alerts.map((alert) => (
                        <li key={alert.id}>
                            <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-indigo-600 truncate">{alert.type}</p>
                                    <div className="ml-2 flex-shrink-0 flex">
                                        <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${alert.risk === 'High' ? 'bg-red-100 text-red-800' :
                                                alert.risk === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-green-100 text-green-800'
                                            }`}>
                                            {alert.risk} Risk
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-2 sm:flex sm:justify-between">
                                    <div className="sm:flex">
                                        <p className="flex items-center text-sm text-gray-500 mr-6">
                                            User: {alert.user}
                                        </p>
                                        <p className="flex items-center text-sm text-gray-500">
                                            Details: {alert.details}
                                        </p>
                                    </div>
                                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                        <p>{alert.time}</p>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
