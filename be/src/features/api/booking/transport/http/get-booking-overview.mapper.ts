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
export const toGetBookingOverviewResponse = (result: GetBookingOverviewResult): GetBookingOverviewResponse => result
