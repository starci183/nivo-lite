/** The bounded request for the workspace's AI work per day, module and kind of work. */
export interface GetCreditWorkUsageRequest {
    /** The workspace selector; the owner or manager role is proved by the domain read. */
    readonly workspaceId: string
    /** The days back from now, 1 to 90 (30 when the caller names none). */
    readonly days: number
}
