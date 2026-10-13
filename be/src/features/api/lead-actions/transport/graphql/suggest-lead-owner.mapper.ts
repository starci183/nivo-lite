import type { LeadActionQueued } from "@modules/domain/lead-actions"
import type { LeadActionRequest } from "../../application/lead-action.contracts"
import type { SuggestLeadOwnerInput } from "./dto/suggest-lead-owner.input"
import type { LeadActionQueuedType } from "./dto/lead-action-queued.type"
import { toLeadActionQueuedType } from "./lead-action-queued.mapper"

/** Maps the bounded input and headers into the queued lead request. */
export const toSuggestLeadOwnerRequest = (
    workspaceId: string,
    input: SuggestLeadOwnerInput,
    acceptLanguage: string,
): LeadActionRequest => ({
    workspaceId,
    acceptLanguage,
    input: {
        leadId: input.leadId,
    },
})

/** Maps the queued lead job to the GraphQL acknowledgement. */
export const toSuggestLeadOwnerType = (result: LeadActionQueued): LeadActionQueuedType => toLeadActionQueuedType(result)
