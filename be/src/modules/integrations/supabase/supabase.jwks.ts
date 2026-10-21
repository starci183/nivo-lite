import { createRemoteJWKSet, jwtVerify } from "jose"
import { ok, refused } from "@modules/platform/primitives"
import { SupabaseErrorCode } from "./errors/supabase.error"
import type { SupabaseOptions, SupabasePrincipal, VerifySupabaseAccessToken } from "./supabase.options"

const AUDIENCE = "authenticated"

/** Creates the verifier for this project's remote JWKS, exact issuer, authenticated audience and pinned algorithm. */
export const createSupabaseAccessTokenVerifier = (options: SupabaseOptions): VerifySupabaseAccessToken => {
    const issuer = `${options.url.replace(/\/$/, "")}/auth/v1`
    const keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
    return async (token) => {
        try {
            const { payload } = await jwtVerify(token, keys, {
                algorithms: ["ES256"],
                audience: AUDIENCE,
                issuer,
            })
            if (typeof payload.sub !== "string" || typeof payload.exp !== "number" || payload.role !== AUDIENCE) {
                return refused(SupabaseErrorCode.AccessTokenInvalid)
            }
            const principal: SupabasePrincipal = {
                id: payload.sub,
                role: AUDIENCE,
                ...(typeof payload.email === "string" ? { email: payload.email } : {}),
                ...(typeof payload.session_id === "string" ? { sessionId: payload.session_id } : {}),
            }
            return ok(principal)
        } catch (cause) {
            return refused(SupabaseErrorCode.AccessTokenInvalid, { cause: String(cause) })
        }
    }
}

/**
 * The verifier of an app that serves no user session (the mcp gateway app): every access token is refused, so the default-deny
 * guard admits only its public and credential doors, and the app needs no Supabase setting or secret.
 */
export const refuseSupabaseSessions: VerifySupabaseAccessToken = () =>
    Promise.resolve(refused(SupabaseErrorCode.AccessTokenInvalid))
