import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white">
          Welcome to{" "}
          <span className="text-blue-600">Smart Attendance AI</span>
        </h1>

        <p className="mt-3 text-2xl text-gray-700 dark:text-gray-300">
          Automated attendance tracking using Facial Recognition
        </p>

        <div className="flex flex-wrap items-center justify-around max-w-4xl mt-6 sm:w-full">
          <Link
            href="/login"
            className="p-6 mt-6 text-left border w-96 rounded-xl hover:text-blue-600 focus:text-blue-600 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition duration-200"
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Login &rarr;</h3>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
              Access your dashboard and manage attendance.
            </p>
          </Link>

          <Link
            href="/register"
            className="p-6 mt-6 text-left border w-96 rounded-xl hover:text-blue-600 focus:text-blue-600 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition duration-200"
          >
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Register &rarr;</h3>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
              Create a new organization or user account.
            </p>
          </Link>
        </div>
      </main>

      <footer className="flex items-center justify-center w-full h-24 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-center gap-2">
          <span className="text-gray-600 dark:text-gray-400">Powered by AI</span>
        </div>
      </footer>
    </div>
  );
}
