/** The figures of get booking overview, as a named part. */
export class GetBookingOverviewFiguresResponse {
    /** The bookings today. */
    bookingsToday!: number

    /** The no show pct30d. */
    noShowPct30d!: number | null

    /** The finished30d. */
    finished30d!: number

    /** The utilisation pct. */
    utilisationPct!: number | null

    /** The deposits pending. */
    depositsPending!: number

    /** The deposits pending vnd. */
    depositsPendingVnd!: number
}

/** The by resource of get booking overview stats, as a named part. */
export class GetBookingOverviewStatsByResourceResponse {
    /** The resource id. */
    resourceId!: string

    /** The name. */
    name!: string

    /** The open min. */
    openMin!: number

    /** The booked min. */
    bookedMin!: number

    /** The pct. */
    pct!: number
}

/** The stats of get booking overview, as a named part. */
export class GetBookingOverviewStatsResponse {
    /** The by resource. */
    byResource!: ReadonlyArray<GetBookingOverviewStatsByResourceResponse>

    /** The by status. */
    byStatus!: Readonly<Record<string, number>>

    /** The no show pct. */
    noShowPct!: number

    /** The done revenue vnd. */
    doneRevenueVnd!: number

    /** The total. */
    total!: number
}

/** The HTTP answer of get-booking-overview. */
export class GetBookingOverviewResponse {
    /** The figures. */
    figures!: GetBookingOverviewFiguresResponse

    /** The stats. */
    stats!: GetBookingOverviewStatsResponse
}
