/** What a password change takes. */
export interface ChangePasswordRequest {
    /** The current password. */
    readonly current: string
    /** The new password. */
    readonly next: string
}
