import type { SubmitLeadRequest, SubmitLeadResult } from "../../application/submit-lead.contracts"
import type { SubmitLeadRequest as SubmitLeadHttpRequest } from "./dto/submit-lead.request"
import type { SubmitLeadResponse } from "./dto/submit-lead.response"

/** Maps the HTTP request to the command request. */
export const toSubmitLeadRequest = (
    authorization: string | undefined,
    input: SubmitLeadHttpRequest,
): SubmitLeadRequest => ({
    authorization,
    name: input.name,
    phone: input.phone,
    email: input.email,
    company: input.company,
    need: input.need,
    channel: input.channel,
    externalId: input.external_id,
    note: input.note,
    stage: input.stage,
})

/** Maps the command result to the HTTP response. */
export const toSubmitLeadResponse = (result: SubmitLeadResult): SubmitLeadResponse => ({
    data: { lead_id: result.leadId, status: result.status },
})
