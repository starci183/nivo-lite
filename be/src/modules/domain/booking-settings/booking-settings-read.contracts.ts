/** The settings of a workspace as other capabilities read them. */
export interface BookingSettingRecord {
    /** The workspace. */
    readonly workspaceId: string
    /** The time zone. */
    readonly timezone: string
    /** The step between slots in minutes. */
    readonly slotStepMin: number
    /** The least notice in minutes. */
    readonly minLeadMin: number
    /** The furthest booking ahead in days. */
    readonly maxAdvanceDays: number
    /** The free cancellation window in hours. */
    readonly cancelWindowHours: number
    /** The deposit percentage. */
    readonly depositPct: number
    /** The late cancellation fee percentage. */
    readonly lateCancelFeePct: number
    /** The no-show fee in VND as a bigint text. */
    readonly noShowFeeVnd: string
    /** Whether bookings confirm by themselves. */
    readonly autoConfirm: boolean
    /** Whether a finished booking goes to the order chain. */
    readonly handoffOrder: boolean
    /** The reminder offsets in hours. */
    readonly reminderHours: ReadonlyArray<number>
    /** Whether the public page is on. */
    readonly publicEnabled: boolean
    /** The public page slug, or null. */
    readonly publicSlug: string | null
    /** The public page note. */
    readonly publicNote: string
    /** The shop address. */
    readonly address: string
}

/** What the public page shows from the settings. */
export interface BookingPublishedSetting {
    /** The workspace. */
    readonly workspaceId: string
    /** The public page note. */
    readonly publicNote: string
    /** The shop address. */
    readonly address: string
    /** The time zone. */
    readonly timezone: string
}

/** The settings a workspace saved, or null when it never saved any. */
export type OptionalBookingSetting = BookingSettingRecord | null

/** The public page settings that are on under a slug, or null when no page is on under it. */
export type OptionalPublishedSetting = BookingPublishedSetting | null
