import { NextResponse, type NextRequest } from "next/server"
import { postAuthPath } from "@/features/auth/destination"
import { requestOrigin } from "@/lib/request-origin"
import { supabaseServer } from "@/lib/supabase/server"
import { isEmailLinkType, writeExchangeCode, writeVerifyEmailLink } from "@/modules/db"
import { APP_ROUTES } from "@/modules/routes"

/** `{{ .RedirectTo }}` can be the e-mail link route's own URL (`/auth/confirm?next=/x`); keep only the inner destination. */
const unwrapNext = (raw: string | null, origin: string): string | null => {
    if (!raw) return null
    try {
        const url = new URL(raw, origin)
        if (url.origin === origin && (url.pathname === "/auth/confirm" || url.pathname === APP_ROUTES.authCallback))
            return url.searchParams.get("next")
        return url.origin === origin ? `${url.pathname}${url.search}` : raw
    } catch {
        return raw
    }
}

/**
 * The one auth return route, in every shape Supabase sends people back in (`/auth/confirm` is rewritten to it, so mailed links keep working):
 * - a PKCE `code` (OAuth, Supabase's own templates);
 * - `token_hash` + `type` (NIVO's e-mail templates), with `next` that may itself be this route's URL.
 * The credential becomes a session cookie, then: recovery -> /reset-password, anything else -> `next` or the console.
 */
export const GET = async (request: NextRequest) => {
    const { searchParams } = request.nextUrl
    const origin = requestOrigin(request)
    const next = unwrapNext(searchParams.get("next"), origin)
    const type = searchParams.get("type")
    const isRecovery = type === "recovery" || next?.startsWith("/reset-password") === true
    const to = (path: string) => NextResponse.redirect(new URL(path, origin))
    const fail = (code: string) =>
        to(isRecovery ? "/reset-password?error=invalid" : `${APP_ROUTES.login}?error=${code}`)

    const providerError = searchParams.get("error_code") ?? searchParams.get("error")
    if (providerError) return fail(providerError === "access_denied" ? "oauth_denied" : "link_expired")

    const code = searchParams.get("code")
    const tokenHash = searchParams.get("token_hash")
    if (code) {
        if ((await writeExchangeCode(code)).kind !== "ok") return fail("link_expired")
    } else if (tokenHash && isEmailLinkType(type)) {
        if ((await writeVerifyEmailLink(type, tokenHash)).kind !== "ok") return fail("link_expired")
    } else {
        return fail(type === null ? "missing_code" : "link_expired")
    }
    if (isRecovery) return to("/reset-password")
    return to(await postAuthPath(await supabaseServer(), next, origin))
}
