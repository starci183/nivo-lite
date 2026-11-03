import type { Clock } from "@modules/platform/clock"
import { ok, refused } from "@modules/platform/primitives"
import type { PrincipalVerifier } from "@modules/integrations/passport"
import { IdentityErrorCode } from "./errors/identity.error"
import type { VerifyAccessToken } from "./identity.contracts"

/** The verifier of the app that signs people in: @starci/auth checks our own access token against our key set, issuer, audience and expiry. */
export const createAccessTokenVerifier =
    (verifier: PrincipalVerifier, clock: Clock): VerifyAccessToken =>
    async (token) => {
        const verified = await verifier.verify(token, clock.now())
        return verified.kind === "ok" ? ok(verified.value) : refused(IdentityErrorCode.AccessTokenInvalid)
    }

/**
 * The verifier of an app that serves no user session (the mcp gateway app): every access token is refused, so the default-deny
 * guard admits only its public and credential doors.
 */
export const refuseSessions: VerifyAccessToken = () => Promise.resolve(refused(IdentityErrorCode.AccessTokenInvalid))
