import type { Clock } from "@modules/platform/clock"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { IdentityErrorCode } from "./errors/identity.error"
import type { VerifyAccessToken } from "./identity.contracts"

/** What the verifier asks of the token client: the claims of a token that passed every check, or a refusal. */
export interface AccessTokenSource {
    /** Verifies one token at one instant. */
    verify(
        token: string,
        now: Date,
    ): Promise<
        Outcome<{ readonly sub: string; readonly email?: string | undefined; readonly sessionId: string }, string>
    >
}

/** The verifier of the app that signs people in: our own access token, checked against our public key, issuer, audience and expiry. */
export const createAccessTokenVerifier =
    (tokens: AccessTokenSource, clock: Clock): VerifyAccessToken =>
    async (token) => {
        const verified = await tokens.verify(token, clock.now())
        if (verified.kind === "refused") return refused(IdentityErrorCode.AccessTokenInvalid)
        const { sub, email, sessionId } = verified.value
        return ok({ id: sub, role: "authenticated", sessionId, ...(email === undefined ? {} : { email }) })
    }

/**
 * The verifier of an app that serves no user session (the mcp gateway app): every access token is refused, so the default-deny
 * guard admits only its public and credential doors.
 */
export const refuseSessions: VerifyAccessToken = () => Promise.resolve(refused(IdentityErrorCode.AccessTokenInvalid))
