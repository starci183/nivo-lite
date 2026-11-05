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
            // Plan, payments and renewal live on the one console billing page.
            { source: "/workspaces/:id/billing", destination: "/billing", permanent: false },
            // The Loyalty workbench is drawn from its spec on the one workbench route; its tabs keep their ids (`?tab=`).
            { source: "/agents/loyalty/:installation/workbench", destination: "/w/loyalty", permanent: false },
            { source: "/agents/loyalty/workbench", destination: "/w/loyalty?tab=pending", permanent: false },
        ]
    },
    // The runtime stage of the Dockerfile ships the standalone output.
    output: "standalone",
    outputFileTracingRoot: resolve(__dirname, "../../.."),
}

export default withNextIntl(nextConfig)
