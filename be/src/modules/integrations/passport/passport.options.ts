import type { AuthOptions } from "@starci/auth/server"

/**
 * The typed settings of the sign-in, parsed once at boot by `passport.config.ts` and handed to @starci/auth: the signing keys
 * (the first with a private key signs; every key verifies and is published as the JWKS), the access and refresh lifetimes, the
 * Google client, the refresh cookie and the sign-in budget. The stores the package needs (sessions, accounts, rate counter)
 * are not settings: `domain/identity` provides them.
 */
export type PassportOptions = Pick<
    AuthOptions,
    | "issuer"
    | "audience"
    | "keys"
    | "accessTtlSeconds"
    | "refreshTtlSeconds"
    | "bcryptCost"
    | "returnOrigin"
    | "google"
    | "cookie"
    | "budget"
>
