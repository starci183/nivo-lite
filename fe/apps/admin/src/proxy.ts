import { createProxy } from "@starci/next-i18n/proxy"
import { NextResponse, type NextRequest } from "next/server"
import { checkSession } from "@/modules/auth-session"
import { consoleLoginUrl } from "@/modules/config"
import { i18n } from "@/modules/i18n"

/**
 * Every page of this app is a route of `/` (`/`, `/<workspace id>`, `/health`), so `health` is NOT an unnegotiated root here: the shared
 * default would send `/health` past the locale rewrite and 404 the platform health page. Only the liveness route and the framework are left alone.
 */
const negotiateLocale = createProxy(i18n, { unnegotiatedRoots: ["api", "_next", "_vercel"] })

/** The liveness probe answers per request and never needs a session or a locale. */
const LIVENESS_PATH = "/health/live"

/**
 * Locale routing, then the one gate in front of the app: a request whose cookies hold no live session goes to the sign-in page of the console
 * (the session cookie is the console's, shared across the product hosts). Who is a platform admin is the back end's answer to the page's
 * `adminSession` read: a signed-in person who is not one gets a frameless not-found, so the app does not show itself.
 */
export const proxy = async (request: NextRequest): Promise<NextResponse> => {
    if (request.nextUrl.pathname === LIVENESS_PATH) return NextResponse.next()
    const response = negotiateLocale(request)
    const principal = await checkSession(request)
    // A busy or unreachable back end (429, 5xx, network) says nothing about the person: never bounce them for it.
    if (!principal.success && principal.message === "unavailable") return response
    if (principal.success) return response
    return NextResponse.redirect(new URL(consoleLoginUrl()))
}

type ConfigShape = {
    matcher: string[]
}

/** Routes that pass through the proxy: everything except static assets. */
export const config: ConfigShape = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*[.](?:svg|png|jpg|jpeg|webp)$).*)"],
}
