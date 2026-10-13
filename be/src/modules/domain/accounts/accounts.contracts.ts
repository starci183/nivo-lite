/** One signed-in device of the account. */
export interface DeviceSession {
    /** The Auth session id. */
    readonly id: string
    /** The raw user agent the device signed in with. */
    readonly userAgent: string | null
    /** The address the session came from. */
    readonly ip: string | null
    /** When the session was created, ISO 8601. */
    readonly createdAt: string | null
    /** When it was last active, ISO 8601. */
    readonly lastActiveAt: string | null
    /** True for the session the request runs on. */
    readonly isCurrent: boolean
}

/** Everything the account page draws. */
export interface AccountOverview {
    /** The name from the profile, else the email's local part. */
    readonly name: string
    /** The account email. */
    readonly email: string
    /** The identity providers linked to the account (`google`, `email`). */
    readonly providers: ReadonlyArray<string>
    /** The devices signed in, the current one first. */
    readonly sessions: ReadonlyArray<DeviceSession>
}
