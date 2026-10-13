/** What revoke session takes. */
export interface RevokeSessionRequest {
    /** The Auth session of the device to sign out. */
    readonly sessionId: string
}
