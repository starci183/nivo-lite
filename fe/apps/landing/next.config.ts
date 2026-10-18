import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import { appUrl } from "./src/modules/config"

/** The request config lives in this app's i18n module; next-intl compiles it from source. */
const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

/** The npm workspace root: Turbopack resolves the built workspace packages from it, and output tracing is pinned to it. */
const WORKSPACE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

/**
 * The landing owns exactly `/`, `/privacy`, `/terms`, its liveness route and its static files. Everything else on nivo.vn used to be the
 * console (/login, /dashboard, /b/<slug>, e-mail links such as /auth/confirm), so it answers 308 to the same path and query on the console
 * origin. `/api/**` and `/graphql` never reach this app (the edge sends them to the api first).
 */
const LANDING_OWNED =
    "privacy$|terms$|health/|_next/|brand/|images/|api/|graphql$|favicon.ico$|icon.png$|robots.txt$|sitemap.xml$"

const nextConfig: NextConfig = {
    output: "standalone",
    reactStrictMode: true,
    poweredByHeader: false,
    transpilePackages: ["@starci/grammar"],
    experimental: { optimizePackageImports: ["@heroui/react"] },
    outputFileTracingRoot: WORKSPACE_ROOT,
    turbopack: { root: WORKSPACE_ROOT },
    async redirects() {
        const APP_ORIGIN = appUrl()
        return [
            // The Supabase return of the time the Site URL was nivo.vn: the code goes to the console's callback.
            {
                source: "/",
                has: [{ type: "query", key: "code" }],
                destination: `${APP_ORIGIN}/auth/callback`,
                permanent: false,
            },
            { source: `/:path((?!${LANDING_OWNED}).+)`, destination: `${APP_ORIGIN}/:path`, permanent: true },
        ]
    },
}

export default withNextIntl(nextConfig)
