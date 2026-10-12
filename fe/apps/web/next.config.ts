import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data connector drivers (database, mailbox, personal Telegram) stay plain Node modules on the server, never bundled.
  serverExternalPackages: ["pg", "mysql2", "mssql", "imapflow", "mailparser", "telegram", "mammoth", "unpdf"],
  transpilePackages: ["@starci/grammar"],
  experimental: {
    // Excel / CSV / document uploads go through server actions (10 MB files).
    serverActions: { bodySizeLimit: "12mb" },
    optimizePackageImports: ["@heroui/react"],
  },
  // The catalogue moved from /m to /agents ("modules" are now "agents" to the user). Old links, bookmarks and stored hrefs keep working.
  async redirects() {
    return [
      { source: "/m", destination: "/agents", permanent: true },
      { source: "/m/:path*", destination: "/agents/:path*", permanent: true },
    ];
  },
  // The VPS container build (Dockerfile.web) sets NEXT_OUTPUT=standalone; the Netlify build leaves it unset and is unchanged.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
