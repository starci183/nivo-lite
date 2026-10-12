import type {
    GetBookingOverviewRequest,
    GetBookingOverviewResult,
} from "../../application/get-booking-overview.contracts"
import type {
    GetBookingOverviewParamsRequest,
    GetBookingOverviewSearchRequest,
} from "./dto/get-booking-overview.request"
import type { GetBookingOverviewResponse } from "./dto/get-booking-overview.response"

/** Maps the HTTP input of get-booking-overview to the command request. */
export const toGetBookingOverviewRequest = (
    params: GetBookingOverviewParamsRequest,
    query: GetBookingOverviewSearchRequest,
): GetBookingOverviewRequest => ({
    workspaceId: params.workspaceId,
    from: query.from,
    to: query.to,
    installationId: query.installationId,
})

/** Maps the get-booking-overview result to the HTTP answer. */
export const toGetBookingOverviewResponse = (result: GetBookingOverviewResult): GetBookingOverviewResponse => ({
    figures: {
        bookingsToday: result.figures.bookingsToday,
        noShowPct30d: result.figures.noShowPct30d,
        finished30d: result.figures.finished30d,
        utilisationPct: result.figures.utilisationPct,
        depositsPending: result.figures.depositsPending,
        depositsPendingVnd: result.figures.depositsPendingVnd,
    },
    stats: {
        byResource: result.stats.byResource.map((i2) => ({
            resourceId: i2.resourceId,
            name: i2.name,
            openMin: i2.openMin,
            bookedMin: i2.bookedMin,
            pct: i2.pct,
        })),
        byStatus: { ...result.stats.byStatus },
        noShowPct: result.stats.noShowPct,
        doneRevenueVnd: result.stats.doneRevenueVnd,
        total: result.stats.total,
    },
})
