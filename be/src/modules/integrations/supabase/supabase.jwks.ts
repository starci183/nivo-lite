import { ok, refused } from "@modules/platform/primitives"
import { SupabaseErrorCode } from "./errors/supabase.error"
import type { SupabaseOptions, SupabasePrincipal, VerifySupabaseAccessToken } from "./supabase.options"

const AUDIENCE = "authenticated"

/**
 * Creates the verifier for this project's remote JWKS, exact issuer, authenticated audience and pinned algorithm.
 * `jose` is an ES module: it loads on the first verification, so importing this integration never loads it.
 */
export const createSupabaseAccessTokenVerifier = (options: SupabaseOptions): VerifySupabaseAccessToken => {
    const issuer = `${options.url.replace(/\/$/, "")}/auth/v1`
    let loaded: ReturnType<typeof load> | undefined
    const load = () =>
        import("jose").then((jose) => ({
            jwtVerify: jose.jwtVerify,
            keys: jose.createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)),
        }))
    return async (token) => {
        try {
            const { jwtVerify, keys } = await (loaded ??= load())
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
            }
            return ok(principal)
        } catch (cause) {
            return refused(SupabaseErrorCode.AccessTokenInvalid, { cause: String(cause) })
        }
    }
}
