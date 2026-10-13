/** What the platform-admin capability takes from the app root. */
export interface PlatformAdminOptions {
    /** The emails of the platform team, lower-cased; nobody else sees the console. */
    readonly admins: ReadonlyArray<string>
}
