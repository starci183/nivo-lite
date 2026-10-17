import "server-only"

import { NextResponse, type NextRequest } from "next/server"
import { exchangeAuthCode, verifyOtp } from "@/modules/auth/server"
import { APP_ROUTES, AUTH_ROUTES, requestOrigin, safeNextPath } from "@/modules/routes"

/** Exchanges one provider credential and redirects to the validated destination, preserving legacy email links. */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
    const { searchParams } = request.nextUrl
    const origin = requestOrigin(request)
    const rawNext = searchParams.get("next")
    const inner = rawNext ? safeNextPath(rawNext, origin) : null
    const innerUrl = new URL(inner ?? "/", origin)
    const directNext = inner === "/" && rawNext !== "/" ? null : inner
    const isNested = innerUrl.pathname === "/auth/confirm" || innerUrl.pathname === APP_ROUTES.authCallback
    const next = directNext !== null && isNested ? safeNextPath(innerUrl.searchParams.get("next"), origin) : directNext
    const type = searchParams.get("type")
    const isRecovery = type === "recovery" || next?.startsWith("/reset-password") === true
    const providerError = searchParams.get("error_code") ?? searchParams.get("error")
    if (providerError) {
        const error = providerError === "access_denied" ? "oauth_denied" : "link_expired"
        return NextResponse.redirect(
            new URL(isRecovery ? "/reset-password?error=invalid" : `${APP_ROUTES.login}?error=${error}`, origin),
        )
    }

    const code = searchParams.get("code")
    const tokenHash = searchParams.get("token_hash")
    if (code) {
        if (!(await exchangeAuthCode(code)).success) {
            return NextResponse.redirect(
                new URL(
                    isRecovery ? "/reset-password?error=invalid" : `${APP_ROUTES.login}?error=link_expired`,
                    origin,
                ),
            )
        }
    } else if (tokenHash && type) {
        if (!(await verifyOtp({ token_hash: tokenHash, type })).success) {
            return NextResponse.redirect(
                new URL(
                    isRecovery ? "/reset-password?error=invalid" : `${APP_ROUTES.login}?error=link_expired`,
                    origin,
                ),
            )
        }
    } else {
        const error = type === null ? "missing_code" : "link_expired"
        return NextResponse.redirect(
            new URL(isRecovery ? "/reset-password?error=invalid" : `${APP_ROUTES.login}?error=${error}`, origin),
        )
    }
    return NextResponse.redirect(new URL(isRecovery ? "/reset-password" : (next ?? AUTH_ROUTES.workspaces), origin))
}
