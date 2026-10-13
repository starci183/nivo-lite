import type { ListLeadsRequest, ListLeadsResult } from "../../application/list-leads.contracts"
import type { ListLeadsRequest as ListLeadsHttpRequest } from "./dto/list-leads.request"
import type { ListLeadsResponse } from "./dto/list-leads.response"

/** Maps the HTTP request to the query request. */
export const toListLeadsRequest = (
    authorization: string | undefined,
    input: ListLeadsHttpRequest,
): ListLeadsRequest => ({
    authorization,
    stage: input.status,
    limit: input.limit,
})

/** Maps the query result to the HTTP response. */
export const toListLeadsResponse = (result: ListLeadsResult): ListLeadsResponse => ({
    data: result.map((lead) => ({
        id: lead.id,
        name: lead.name,
        company: lead.company,
        channel: lead.channel,
        need: lead.need,
        stage: lead.stage,
        phone: lead.phone,
        email: lead.email,
        created_at: lead.createdAt,
    })),
})
