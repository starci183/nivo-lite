/** A catalog, exception or waitlist row selected within a workspace. */
export interface BookingSetupRef {
    /** The workspace whose manager makes the change. */
    readonly workspaceId: string
    /** The row to change. */
    readonly id: string
}

/** A service to create, or an existing service to change. */
export interface SaveBookingServiceParams {
    /** The workspace whose catalog is changed. */
    readonly workspaceId: string
    /** The existing service, or null to create one. */
    readonly id: string | null
    /** The name customers see. */
    readonly name: string
    /** A description of the service. */
    readonly description: string
    /** The visit length, between 5 and 1440 minutes. */
    readonly durationMin: number
    /** The resource's rest after the visit, between 0 and 480 minutes. */
    readonly bufferMin: number
    /** The price in VND, or null when no price is fixed. */
    readonly priceVnd: number | null
    /** The required resource kind, or an empty string for any kind. */
    readonly resourceKind: string
    /** Days before a follow-up, or null to disable it. */
    readonly followupDays: number | null
    /** Whether the service accepts new bookings. */
    readonly active: boolean
}

/** A person, room or chair to create or change. */
export interface SaveBookingResourceParams {
    /** The workspace whose resources are changed. */
    readonly workspaceId: string
    /** The existing resource, or null to create one. */
    readonly id: string | null
    /** The resource's display name. */
    readonly name: string
    /** The free-text kind, defaulting to staff when empty. */
    readonly kind: string
    /** How many customers it serves at once, between 1 and 200. */
    readonly capacity: number
    /** Whether the resource accepts bookings. */
    readonly active: boolean
    /** A staff member of this workspace, or null. */
    readonly staffId: string | null
}

/** One weekly opening window. */
export interface BookingHoursWindow {
    /** The ISO weekday, Monday 1 through Sunday 7. */
    readonly weekday: number
    /** The opening clock time, HH:MM. */
    readonly start: string
    /** The closing clock time, HH:MM. */
    readonly end: string
}

/** All weekly opening windows of one resource, replaced atomically. */
export interface SaveBookingHoursParams {
    /** The workspace whose calendar is changed. */
    readonly workspaceId: string
    /** The resource whose opening windows are replaced. */
    readonly resourceId: string
    /** Up to 56 non-overlapping opening windows. */
    readonly rows: ReadonlyArray<BookingHoursWindow>
}

/** A closing or a special opening window to add. */
export interface SaveBookingExceptionParams {
    /** The workspace whose calendar is changed. */
    readonly workspaceId: string
    /** A resource of the workspace, or null for the whole business. */
    readonly resourceId: string | null
    /** A valid local date, YYYY-MM-DD. */
    readonly date: string
    /** Whether the date is closed. */
    readonly closed: boolean
    /** The opening clock time for an open exception, HH:MM. */
    readonly start: string
    /** The closing clock time for an open exception, HH:MM. */
    readonly end: string
    /** The manager's note. */
    readonly note: string
}

/** Cancellation, deposit and availability rules to save. */
export interface SaveBookingPolicyParams {
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

/** Publishing settings to save without changing booking policy. */
export interface SaveBookingPublicPageParams {
    /** The workspace whose page is changed. */
    readonly workspaceId: string
    /** Whether customers may use the public page. */
    readonly enabled: boolean
    /** The desired public slug, empty only while disabled. */
    readonly slug: string
    /** The note displayed to customers. */
    readonly note: string
}

/** The catalog, calendar or waitlist row that changed. */
export interface BookingSetupSaved {
    /** The saved row id; for hours, the owning resource id. */
    readonly id: string
}

/** The workspace whose settings changed. */
export interface BookingSettingsSaved {
    /** The workspace id. */
    readonly workspaceId: string
}
