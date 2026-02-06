import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'export',      // Key for GitHub Pages static export
  images: {
    unoptimized: true,   // GitHub Pages doesn't support Next.js Image Optimization API
  },
  // If your repo is 'my-portfolio', your URL is username.github.io/my-portfolio/
  // You MUST add the repo name as the basePath
  basePath: '/Presenza-AI',
};

export default nextConfig;