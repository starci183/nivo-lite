/** What the sign-in side of identity needs from its environment, parsed once at the composition root. */
export interface IdentityAuthOptions {
    /** How long an invite password link lives, in seconds. */
    readonly inviteTtlSeconds: number
}
