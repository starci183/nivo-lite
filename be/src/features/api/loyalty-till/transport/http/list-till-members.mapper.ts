import type { ListTillMembersRequest, ListTillMembersResult } from "../../application/list-till-members.contracts"
import type { ListTillMembersSearchRequest } from "./dto/list-till-members.request"
import type { ListTillMembersResponse } from "./dto/list-till-members.response"

/** Maps the HTTP input of list-till-members to the command request. */
export const toListTillMembersRequest = (
    query: ListTillMembersSearchRequest,
    authorization: string,
): ListTillMembersRequest => ({ phone: query.phone, limit: query.limit, authorization: authorization })

/** Maps the list-till-members result to the HTTP answer. */
export const toListTillMembersResponse = (result: ListTillMembersResult): ListTillMembersResponse => ({
    members: result.members.map((i1) => ({
        customer_id: i1.customerId,
        name: i1.name,
        phone: i1.phone,
        email: i1.email,
        tier: i1.tier,
        points: i1.points,
        lifetime_spend_vnd: i1.lifetimeSpendVnd,
        visits: i1.visits,
        last_visit_at: i1.lastVisitAt,
    })),
})
