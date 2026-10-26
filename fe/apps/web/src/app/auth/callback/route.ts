import "server-only"

import { NextResponse, type NextRequest } from "next/server"
import { callbackNext } from "@/modules/auth"
import { exchangeAuthCode, requestOrigin, verifyOtp } from "@/modules/auth/server"
import { APP_ROUTES, AUTH_ROUTES } from "@/modules/routes"

/** Exchanges one provider credential and redirects to the validated destination, preserving legacy email links. */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
    const { searchParams } = request.nextUrl
    const origin = requestOrigin(request)
    const next = callbackNext(searchParams.get("next"), origin)
    const type = searchParams.get("type")
    const isRecovery = type === "recovery" || next?.startsWith("/reset-password") === true
    const recoveryFailure = isRecovery ? "/reset-password?error=invalid" : null
    const providerError = searchParams.get("error_code") ?? searchParams.get("error")
    if (providerError) {
        const error = providerError === "access_denied" ? "oauth_denied" : "link_expired"
        return NextResponse.redirect(new URL(recoveryFailure ?? `${APP_ROUTES.login}?error=${error}`, origin))
    }

    const code = searchParams.get("code")
    const tokenHash = searchParams.get("token_hash")
    const successDestination = isRecovery ? "/reset-password" : (next ?? AUTH_ROUTES.workspaces)
    const failureDestination = recoveryFailure ?? `${APP_ROUTES.login}?error=link_expired`
    if (code) {
        const result = await exchangeAuthCode(code)
        return NextResponse.redirect(new URL(result.success ? successDestination : failureDestination, origin))
    }
    if (tokenHash && type) {
        const result = await verifyOtp({ token_hash: tokenHash, type })
        return NextResponse.redirect(new URL(result.success ? successDestination : failureDestination, origin))
    }
    const error = type === null ? "missing_code" : "link_expired"
    return NextResponse.redirect(new URL(recoveryFailure ?? `${APP_ROUTES.login}?error=${error}`, origin))
}
