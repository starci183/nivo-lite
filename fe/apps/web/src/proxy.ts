import { negotiateLocale } from "@nivo-lite/i18n/proxy"
import { NextRequest, NextResponse } from "next/server"
import { sessionCookieOptions } from "./modules/config"
import { checkSession, onPublicOrigin } from "./modules/auth"
import { LOCALES, LOCALE_COOKIE } from "./modules/i18n"

// The two destinations the proxy redirects to; the proxy cannot evaluate the routes barrel, so it names them itself.
const LOGIN_PATH = "/login"
const DASHBOARD_PATH = "/dashboard"

// Reachable without a session. Webhooks (Telegram, bank connection) are each verified by their own secret header; /api/n8n by a per-run bearer token (hash stored with an expiry).
const PUBLIC_PATHS = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/auth",
    "/invite",
    "/api/telegram",
    "/api/connections",
    "/api/engine",
    "/api/v1",
    "/api/automation",
    "/api/content",
    "/api/n8n",
    "/b",
    "/api/b",
    "/j",
    "/l",
    "/health",
] // /b/<slug> and /api/b/<slug>: the public booking page (rate limited, honeypot, gate)

// Roots the locale rewrite never touches: handlers, liveness and framework files. Every other path is served
// from /<locale>/... while the URL stays unprefixed (localePrefix "never"; the NIVO_LOCALE cookie decides).
const UNNEGOTIATED_ROOTS: ReadonlySet<string> = new Set(["api", "health", "_next", "_vercel"])

/** Segment-aware prefix match, so "/auth" never swallows "/authority". */
const isPublicPath = (pathname: string): boolean =>
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/** Only same-site paths may come back through `?next=`. */
const safeNext = (value: string | null): string | null =>
    value && value.startsWith("/") && !value.startsWith("//") ? value : null

/**
 * The request the proxy and the locale negotiation see: no Accept-Language (a first visit stays Vietnamese-first, the reader opts
 * into English with the switch).
 */
const incomingOf = (request: NextRequest): NextRequest => {
    const headers = new Headers(request.headers)
    headers.delete("accept-language")
    return new NextRequest(request, { headers })
}

/** The language the landing site hands over (`?lang=vi|en`), or null when the address carries none. */
const handedOverLocale = (request: NextRequest): (typeof LOCALES)[number] | null => {
    const lang = request.nextUrl.searchParams.get("lang")
    return LOCALES.find((locale) => locale === lang) ?? null
}

/** Stores the handed-over language in the locale cookie and reopens the same address without the parameter. */
const adoptLocale = (request: NextRequest, locale: (typeof LOCALES)[number]): NextResponse => {
    const clean = request.nextUrl.clone()
    clean.searchParams.delete("lang")
    const out = NextResponse.redirect(onPublicOrigin(request, clean))
    out.cookies.set(LOCALE_COOKIE, locale, { ...sessionCookieOptions, path: "/", maxAge: 60 * 60 * 24 * 365 })
    return out
}

/** Checks the session with the back end (cookies forwarded), applies the locale rewrite, gates private paths (a disabled seat is refused by the back end). */
export const proxy = async (original: NextRequest): Promise<NextResponse> => {
    const request = incomingOf(original)
    const { pathname } = request.nextUrl
    const handedOver = handedOverLocale(request)
    if (handedOver !== null) return adoptLocale(request, handedOver)
    const stamped = (): NextResponse => negotiateLocale(request, UNNEGOTIATED_ROOTS)
    const response = stamped()
    const principal = await checkSession(request)
    const isPublic = isPublicPath(pathname)

    /** A redirect on the public origin, never the server bind address. */
    const redirectTo = (url: URL): NextResponse => NextResponse.redirect(onPublicOrigin(request, url))
    const loginUrl = (): URL => {
        const url = request.nextUrl.clone()
        url.pathname = LOGIN_PATH
        url.search = ""
        return url
    }

    if (!principal.success) {
        if (isPublic) return response
        const url = loginUrl()
        if (pathname !== "/") url.searchParams.set("next", `${pathname}${request.nextUrl.search}`)
        return redirectTo(url)
    }

    // Signed-in users who open the sign-in page go straight to where they were headed.
    if (pathname === LOGIN_PATH && request.nextUrl.searchParams.get("reason") !== "disabled") {
        const url = request.nextUrl.clone()
        const next = safeNext(request.nextUrl.searchParams.get("next"))
        url.pathname = DASHBOARD_PATH
        url.search = ""
        return redirectTo(next ? new URL(next, request.nextUrl.origin) : url)
    }

    return response
}

/** Routes that pass through the proxy: everything except static assets. */
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*[.](?:svg|png|jpg|jpeg|webp)$).*)"],
}
