import type { AwardTillPointsRequest, AwardTillPointsResult } from "../../application/award-till-points.contracts"
import type { AwardTillPointsBodyRequest } from "./dto/award-till-points.request"
import type { AwardTillPointsResponse } from "./dto/award-till-points.response"

/** Maps the HTTP input of award-till-points to the command request. */
export const toAwardTillPointsRequest = (
    body: AwardTillPointsBodyRequest,
    authorization: string,
): AwardTillPointsRequest => ({
    phone: body.phone,
    name: body.name,
    amountVnd: body.amount_vnd,
    ref: body.ref,
    items: body.items,
    occurredAt: body.occurred_at,
    authorization: authorization,
})

/** Maps the award-till-points result to the HTTP answer. */
export const toAwardTillPointsResponse = (result: AwardTillPointsResult): AwardTillPointsResponse => ({
    status: result.status,
    customer: {
        customer_id: result.customer.customerId,
        name: result.customer.name,
        phone: result.customer.phone,
        email: result.customer.email,
        tier: result.customer.tier,
        points: result.customer.points,
        lifetime_spend_vnd: result.customer.lifetimeSpendVnd,
        visits: result.customer.visits,
        last_visit_at: result.customer.lastVisitAt,
    },
})
