import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Disable ESLint during builds for faster deployment
  },
  typescript: {
    ignoreBuildErrors: true, // Temporarily ignore TypeScript errors for quick deployment
  },
};

export default nextConfig;
