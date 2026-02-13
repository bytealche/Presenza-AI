import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    unoptimized: true,   // GitHub Pages doesn't support Next.js Image Optimization API
  },
  ...(isProd ? {
    output: 'export',      // Key for GitHub Pages static export
    basePath: '/Presenza-AI',
  } : {}),
};

export default nextConfig;