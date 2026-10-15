import "server-only"
import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { routing } from "./routing"

const negotiate = createMiddleware(routing)

/** Whether the path belongs to one of the roots no locale is negotiated for, or is a file with an extension. */
const isUnnegotiated = (pathname: string, roots: ReadonlySet<string>): boolean => {
    const segments = pathname.split("/")
    const last = segments.at(-1) ?? ""
    return roots.has(segments[1] ?? "") || (last.includes(".") && !last.endsWith("."))
}

/**
 * The locale step of an app's proxy: the language is the NIVO_LOCALE cookie (the address never carries it), so a path is rewritten to its
 * `[locale]` form, except for the roots the app lists (handlers, liveness, framework files) and any file with an extension.
 */
export const negotiateLocale = (request: NextRequest, unnegotiatedRoots: ReadonlySet<string>): NextResponse =>
    isUnnegotiated(request.nextUrl.pathname, unnegotiatedRoots) ? NextResponse.next({ request }) : negotiate(request)
