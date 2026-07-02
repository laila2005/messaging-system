import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ts-ignore
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: "export",
  images: { unoptimized: true }
};

export default nextConfig;
