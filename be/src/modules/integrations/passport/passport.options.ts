import type { InjectionToken } from "@nestjs/common"
import type { Secret } from "@modules/platform/config"

/** The Google OAuth client and where Google sends the browser back. */
export interface PassportGoogleOptions {
    /** The public client id. */
    readonly clientId: string
    /** The client secret. */
    readonly clientSecret: Secret
    /** The registered callback address (`<api>/auth/google/callback`). */
    readonly callbackUrl: string
}

/** What the password hasher needs: the bcrypt cost of a new hash. */
export interface PasswordsOptions {
    /** The bcrypt cost of a new password hash. */
    readonly bcryptCost: number
}

/** Options of the passport integration, parsed once at boot. */
export interface PassportOptions {
    /** The Ed25519 private key (PKCS#8 PEM) that signs access tokens. */
    readonly privateKey: Secret
    /** The matching public key (SPKI PEM) published at the JWKS endpoint. */
    readonly publicKey: string
    /** The `kid` of the signing key; derived from the key when absent. */
    readonly keyId: string | undefined
    /** The `iss` claim. */
    readonly issuer: string
    /** The origin of the web app: an absolute return address is accepted only on this origin. */
    readonly returnOrigin: string
    /** The `aud` claim. */
    readonly audience: string
    /** How long an access token lives, in seconds. */
    readonly accessTtlSeconds: number
    /** The bcrypt cost of a new password hash. */
    readonly bcryptCost: number
    /** The Google client; null when the deployment has none (the Google door is then unavailable). */
    readonly google: PassportGoogleOptions | null
    /** The provider token of the app authenticator. */
    readonly authenticator: InjectionToken
}
