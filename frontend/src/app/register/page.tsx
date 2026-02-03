"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";

export default function Register() {
  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleRegister = async () => {
    try {
      const res = await api.post("/auth/register", { org_name: orgName, full_name: fullName, email, password });
      // Save token if successful
      if (res.data.access_token) {
        localStorage.setItem("token", res.data.access_token);
        alert("Registration successful. You are now logged in.");
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    } catch (error) {
      console.error(error);
      alert("Registration failed");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-8 bg-white dark:bg-gray-800 rounded-xl shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">Register Organization</h1>

        <input
          className="w-full border p-2 mb-4 rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          onChange={e => setOrgName(e.target.value)}
          placeholder="Organization Name"
        />
        <input
          className="w-full border p-2 mb-4 rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          onChange={e => setFullName(e.target.value)}
          placeholder="Full Name"
        />
        <input
          className="w-full border p-2 mb-4 rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          className="w-full border p-2 mb-6 rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          type="password"
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
        />

        <button
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
          onClick={handleRegister}
        >
          Register
        </button>
      </div>
    </div>
  );
}
