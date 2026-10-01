import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@starci/grammar"],
  experimental: { optimizePackageImports: ["@heroui/react"] },
};

export default nextConfig;
