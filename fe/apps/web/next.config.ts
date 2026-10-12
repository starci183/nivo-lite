import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

/** The request config lives in this app's i18n module. */
const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

const nextConfig: NextConfig = {
    // Data connector drivers (database, mailbox, personal Telegram) stay plain Node modules on the server, never bundled.
    serverExternalPackages: ["pg", "mysql2", "mssql", "imapflow", "mailparser", "telegram", "mammoth", "unpdf"],
    transpilePackages: ["@starci/grammar"],
    poweredByHeader: false,
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
        ]
    },
    // E-mail links mailed before the auth return routes merged still point at /auth/confirm: one route now serves both.
    async rewrites() {
        return [{ source: "/auth/confirm", destination: "/auth/callback" }]
    },
    // The VPS container build (Dockerfile.web) sets NEXT_OUTPUT=standalone; the Netlify build leaves it unset and is unchanged.
    ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
}

export default withNextIntl(nextConfig)
