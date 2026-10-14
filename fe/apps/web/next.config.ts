import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import { resolve } from "node:path"

/** The request config lives in this app's i18n module. */
const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

const nextConfig: NextConfig = {
    transpilePackages: ["@starci/grammar"],
    poweredByHeader: false,
    experimental: {
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
    // The runtime stage of the Dockerfile ships the standalone output.
    output: "standalone",
    outputFileTracingRoot: resolve(__dirname, "../../.."),
}

export default withNextIntl(nextConfig)
