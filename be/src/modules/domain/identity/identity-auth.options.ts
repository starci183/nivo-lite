/** What the sign-in side of identity needs from its environment, parsed once at the composition root. */
export interface IdentityAuthOptions {
    /** The public origin of the web app (reset links, post-login redirects). */
    readonly webOrigin: string
    /** The `Domain` of the refresh cookie; undefined makes it host-only. */
    readonly cookieDomain: string | undefined
    /** How long a refresh token lives, in seconds. */
    readonly refreshTtlSeconds: number
    /** How long a reset link lives, in seconds. */
    readonly resetTtlSeconds: number
    /** How long an invite password link lives, in seconds. */
    readonly inviteTtlSeconds: number
    /** Sign-in attempts per address in one window. */
    readonly loginAttempts: number
    /** Reset requests per address in one window. */
    readonly resetAttempts: number
    /** The attempt window, in milliseconds. */
    readonly attemptWindowMs: number
}
