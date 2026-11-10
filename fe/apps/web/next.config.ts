import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import { resolve } from "node:path"

/** The request config lives in this app's i18n module. */
const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts")

/** Drops the trailing slashes of an origin. */
const withoutTrailingSlash = (value: string): string => {
    let end = value.length
    while (value[end - 1] === "/") end -= 1
    return value.slice(0, end)
}

/**
 * The platform-admin area lives in its own app (fe/apps/admin), so `/admin` and everything under it answers a temporary redirect to the same
 * path on the admin origin (`/admin/<workspace>` -> `<origin>/<workspace>`, `/admin/health` -> `<origin>/health`). NEXT_PUBLIC_ADMIN_URL is that origin.
 * A dev stack served on both a tunnel and localhost also sets NEXT_PUBLIC_LOCAL_ADMIN_URL: the console opened on localhost goes to the local admin
 * (the session cookie stays on the host the person signed in on), the console opened on any other host goes to the tunnel admin.
 */
const adminRedirects = async (): Promise<Awaited<ReturnType<NonNullable<NextConfig["redirects"]>>>> => {
    const admin = process.env.NEXT_PUBLIC_ADMIN_URL
    if (admin === undefined || admin === "") return []
    const local = process.env.NEXT_PUBLIC_LOCAL_ADMIN_URL
    const routes = (origin: string) => [
        { source: "/admin", destination: `${withoutTrailingSlash(origin)}/`, permanent: false },
        { source: "/admin/:path*", destination: `${withoutTrailingSlash(origin)}/:path*`, permanent: false },
    ]
    const onLocalHost = [{ type: "host" as const, value: "(localhost|127[.]0[.]0[.]1)" }]
    return [
        ...(local === undefined || local === "" ? [] : routes(local).map((route) => ({ ...route, has: onLocalHost }))),
        ...routes(admin),
    ]
}

const nextConfig: NextConfig = {
    transpilePackages: ["@starci/grammar"],
    poweredByHeader: false,
    experimental: {
        optimizePackageImports: ["@heroui/react"],
    },
    // The runtime stage of the Dockerfile ships the standalone output.
    output: "standalone",
    outputFileTracingRoot: resolve(__dirname, "../../.."),
    redirects: adminRedirects,
}

export default withNextIntl(nextConfig)
