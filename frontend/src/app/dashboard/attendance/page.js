"use client";
import { useEffect, useState } from "react";
import { getAttendance } from "@/services/attendanceService";

export default function AttendancePage() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    getAttendance().then(setRecords);
  }, []);

  return (
    <div>
      <h2>Attendance Records</h2>

      <table border="1">
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>Score</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.attendance_id}>
              <td>{r.user_id}</td>
              <td>{r.final_status}</td>
              <td>{r.final_score?.toFixed(2)}</td>
              <td>{new Date(r.decision_time).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
