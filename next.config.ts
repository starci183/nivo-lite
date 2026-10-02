import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@starci/grammar"],
  serverExternalPackages: ["undici"],
  experimental: { optimizePackageImports: ["@heroui/react"] },
  // The VPS container build (Dockerfile.web) sets NEXT_OUTPUT=standalone; the Netlify build leaves it unset and is unchanged.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
