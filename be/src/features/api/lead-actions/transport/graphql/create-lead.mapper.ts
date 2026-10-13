import type { LeadActionQueued } from "@modules/domain/lead-actions"
import type { LeadActionRequest } from "../../application/lead-action.contracts"
import type { CreateLeadInput } from "./dto/create-lead.input"
import type { LeadActionQueuedType } from "./dto/lead-action-queued.type"
import { toLeadActionQueuedType } from "./lead-action-queued.mapper"

/** Maps the bounded input and headers into the queued lead request. */
export const toCreateLeadRequest = (
    workspaceId: string,
    input: CreateLeadInput,
    acceptLanguage: string,
): LeadActionRequest => ({
    workspaceId,
    acceptLanguage,
    input: {
        contactName: input.contactName,
        company: input.company,
        channel: input.channel,
        need: input.need,
        phone: input.phone,
        email: input.email,
    },
})

/** Maps the queued lead job to the GraphQL acknowledgement. */
export const toCreateLeadType = (result: LeadActionQueued): LeadActionQueuedType => toLeadActionQueuedType(result)
