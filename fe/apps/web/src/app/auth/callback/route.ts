import "server-only"

import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { exchangeAuthCode, verifyEmailLink } from "@/modules/auth"
import { APP_ROUTES, AUTH_ROUTES, requestOrigin, safeNextPath } from "@/modules/routes"

const EMAIL_LINK_ROUTES: ReadonlySet<string> = new Set(["/auth/confirm", APP_ROUTES.authCallback])

/** `{{ .RedirectTo }}` can be this route's own URL (`/auth/confirm?next=/x`); keep only the inner same-origin destination. */
const unwrapNext = (raw: string | null, origin: string): string | null => {
    if (!raw) return null
    const inner = safeNextPath(raw, origin)
    if (inner === "/" && raw !== "/") return null
    const url = new URL(inner, origin)
    return EMAIL_LINK_ROUTES.has(url.pathname) ? safeNextPath(url.searchParams.get("next"), origin) : inner
}

/**
 * The one auth return route, in every shape Supabase sends people back in (`/auth/confirm` is rewritten to it, so mailed links keep working):
 * - a PKCE `code` (OAuth, Supabase's own templates);
 * - `token_hash` + `type` (NIVO's e-mail templates), with `next` that may itself be this route's URL.
 * The credential becomes a session cookie, then: recovery -> /reset-password, anything else -> `next` or the workspaces home.
 */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
    const { searchParams } = request.nextUrl
    const origin = requestOrigin(request)
    const next = unwrapNext(searchParams.get("next"), origin)
    const type = searchParams.get("type")
    const isRecovery = type === "recovery" || next?.startsWith("/reset-password") === true
    const to = (path: string): NextResponse => NextResponse.redirect(new URL(path, origin))
    const fail = (code: string): NextResponse =>
        to(isRecovery ? "/reset-password?error=invalid" : `${APP_ROUTES.login}?error=${code}`)

    const providerError = searchParams.get("error_code") ?? searchParams.get("error")
    if (providerError) return fail(providerError === "access_denied" ? "oauth_denied" : "link_expired")

    const code = searchParams.get("code")
    const tokenHash = searchParams.get("token_hash")
    if (code) {
        if (!(await exchangeAuthCode(await cookies(), code)).success) return fail("link_expired")
    } else if (tokenHash && type) {
        if (!(await verifyEmailLink(await cookies(), type, tokenHash)).success) return fail("link_expired")
    } else {
        return fail(type === null ? "missing_code" : "link_expired")
    }
    if (isRecovery) return to("/reset-password")
    return to(next ?? AUTH_ROUTES.workspaces)
}
