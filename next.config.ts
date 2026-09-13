import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@isa-lab/tax-engine"],
};

export default nextConfig;
