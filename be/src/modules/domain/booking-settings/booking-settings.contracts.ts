/** A normalized public slug, or null while no slug is claimed. */
export type BookingSettingsPublicSlug = string | null

/** Booking policy values validated by the application operation that saves them. */
export interface SaveBookingSettingsPolicyParams {
    /** The workspace whose policy is changed. */
    readonly workspaceId: string
    /** Hours before a cancellation is considered late. */
    readonly cancelWindowHours: number
    /** The deposit percentage. */
    readonly depositPct: number
    /** The price percentage charged for late cancellation. */
    readonly lateCancelFeePct: number
    /** The no-show fee in VND. */
    readonly noShowFeeVnd: number
    /** The earliest allowed booking in minutes from now. */
    readonly minLeadMin: number
    /** The furthest allowed booking in days from now. */
    readonly maxAdvanceDays: number
    /** Minutes between suggested starting times. */
    readonly slotStepMin: number
    /** Whether a free public request is confirmed immediately. */
    readonly autoConfirm: boolean
    /** Whether a finished booking is handed to the order chain. */
    readonly handoffOrder: boolean
    /** The business address shown on its public page. */
    readonly address: string
    /** A supported IANA time zone. */
    readonly timezone: string
}

/** Publishing values validated by the application operation that saves them. */
export interface SaveBookingSettingsPublicPageParams {
    /** The workspace whose page is changed. */
    readonly workspaceId: string
    /** Whether customers may use the public page. */
    readonly enabled: boolean
    /** The normalized public slug, or null while unpublished. */
    readonly slug: BookingSettingsPublicSlug
    /** The note displayed to customers. */
    readonly note: string
}

/** The workspace whose booking settings were found or changed. */
export interface BookingSettingsSaved {
    /** The settings row's workspace id. */
    readonly id: string
}
