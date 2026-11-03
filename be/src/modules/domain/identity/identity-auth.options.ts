/** What the sign-in side of identity needs from its environment, parsed once at the composition root. */
export interface IdentityAuthOptions {
    /** The public origin of the web app (reset links, post-login redirects). */
    readonly webOrigin: string
    /** How long a reset link lives, in seconds. */
    readonly resetTtlSeconds: number
    /** How long an invite password link lives, in seconds. */
    readonly inviteTtlSeconds: number
}
