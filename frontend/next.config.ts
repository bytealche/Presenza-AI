import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;