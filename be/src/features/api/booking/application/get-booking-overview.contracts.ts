/** What get-booking-overview takes. */
export interface GetBookingOverviewRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The from. */
    readonly from: string
    /** The to. */
    readonly to: string
    /** The installation id. */
    readonly installationId?: string
}

/** The figures of get booking overview, as a named part. */
export interface GetBookingOverviewFiguresResult {
    /** The bookings today. */
    readonly bookingsToday: number
    /** The no show pct30d. */
    readonly noShowPct30d: number | null
    /** The finished30d. */
    readonly finished30d: number
    /** The utilisation pct. */
    readonly utilisationPct: number | null
    /** The deposits pending. */
    readonly depositsPending: number
    /** The deposits pending vnd. */
    readonly depositsPendingVnd: number
}

/** The by resource of get booking overview stats, as a named part. */
export interface GetBookingOverviewStatsByResourceResult {
    /** The resource id. */
    readonly resourceId: string
    /** The name. */
    readonly name: string
    /** The open min. */
    readonly openMin: number
    /** The booked min. */
    readonly bookedMin: number
    /** The pct. */
    readonly pct: number
}

/** The stats of get booking overview, as a named part. */
export interface GetBookingOverviewStatsResult {
    /** The by resource. */
    readonly byResource: ReadonlyArray<GetBookingOverviewStatsByResourceResult>
    /** The by status. */
    readonly byStatus: Readonly<Record<string, number>>
    /** The no show pct. */
    readonly noShowPct: number
    /** The done revenue vnd. */
    readonly doneRevenueVnd: number
    /** The total. */
    readonly total: number
}

/** What get-booking-overview answers. */
export interface GetBookingOverviewResult {
    /** The figures. */
    readonly figures: GetBookingOverviewFiguresResult
    /** The stats. */
    readonly stats: GetBookingOverviewStatsResult
}
