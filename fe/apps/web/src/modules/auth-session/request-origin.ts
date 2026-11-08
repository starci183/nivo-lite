import type { NextRequest } from "next/server"
import { webSiteOrigin } from "@/modules/config"

/** A bind address the standalone server reports instead of the public host. */
const isBindAddress = (host: string): boolean => host.startsWith("0.0.0.0") || host.startsWith("[::]")
/** A host of the local machine (served over plain http). */
const isLocalHost = (host: string): boolean =>
    host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("[::1]")

/** The first entry of a comma-separated forwarded header; undefined when the header is absent or that entry is empty. */
const firstEntry = (header: string | null): string | undefined => {
    const entry = header?.split(",")[0]?.trim()
    return entry === "" ? undefined : entry
}

/**
 * The public origin the browser used for this request. Behind the Traefik edge the standalone Next server reports its own bind address
 * (http://0.0.0.0:3000) in `request.nextUrl`, so redirects built from it are unreachable. The forwarded host/proto from the edge win,
 * then the Host header, then NEXT_PUBLIC_SITE_URL; `nextUrl.origin` is only the last resort (local `next dev`).
 */
export const requestOrigin = (request: NextRequest): string => {
    const host = firstEntry(request.headers.get("x-forwarded-host")) ?? request.headers.get("host")
    if (host && !isBindAddress(host)) {
        const proto = firstEntry(request.headers.get("x-forwarded-proto")) ?? (isLocalHost(host) ? "http" : "https")
        return `${proto}://${host}`
    }
    try {
        return new URL(webSiteOrigin() ?? "").origin
    } catch {
        return request.nextUrl.origin
    }
}

/** The same URL (path, query) moved onto the public origin. */
export const onPublicOrigin = (request: NextRequest, url: URL): URL =>
    new URL(`${url.pathname}${url.search}`, requestOrigin(request))
