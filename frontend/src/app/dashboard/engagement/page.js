export default function EngagementPage() {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Student Engagement</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Attention Span Over Time</h3>
                    <div className="h-64 bg-gray-50 rounded flex items-center justify-center text-gray-400">
                        [Line Chart: Avg Attention Minutes]
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Participation vs Attendance</h3>
                    <div className="h-64 bg-gray-50 rounded flex items-center justify-center text-gray-400">
                        [Scatter Plot]
                    </div>
                </div>
            </div>
        </div>
    );
}
