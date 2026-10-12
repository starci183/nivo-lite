/** How an invitation left Auth: a new account invite email, a sign-in link, or not at all (copy the link). */
export type InviteSent = "invited" | "existing" | "none"

/** One Supabase Auth account as the domains need it. */
export interface AuthAccount {
    /** The Auth user identifier. */
    readonly id: string
    /** The account email, empty when the account has none. */
    readonly email: string
    /** The last sign-in instant as Auth reports it. */
    readonly lastSignInAt: string | null
    /** The avatar from the provider profile. */
    readonly avatarUrl: string | null
    /** The name from the profile, else the email's local part. */
    readonly displayName: string
}
