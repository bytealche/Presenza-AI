import Link from "next/link";

export default function TeacherDashboard() {
  return (
    <div>
      <h1>Teacher Dashboard</h1>

      <Link href="/dashboard/attendance">
        View Attendance
      </Link>
    </div>
  );
}
