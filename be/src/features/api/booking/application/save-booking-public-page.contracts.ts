/** Input for save-booking-public-page. */
export interface SaveBookingPublicPageRequest {
    /** The workspace that owns these booking settings. */
    readonly workspaceId: string
    /** Whether the public booking page is enabled. */
    readonly enabled: boolean
    /** The unique public booking page slug. */
    readonly slug: string
    /** The note displayed on the public booking page. */
    readonly note: string
}

/** Confirms where publication settings were persisted. */
export interface SaveBookingPublicPageResult {
    /** Use this value to refresh the affected page settings. */
    readonly workspaceId: string
}
