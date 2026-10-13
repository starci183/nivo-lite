/** What setSyncSchedule takes. */
export interface SetSyncScheduleRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The data connection. */
    readonly connectionId: string
    /** Minutes between two scheduled syncs, 5 to 10080; null is manual only. */
    readonly everyMinutes: number | null
}
