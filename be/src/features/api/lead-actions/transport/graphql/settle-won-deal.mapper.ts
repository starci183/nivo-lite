import type { LeadActionQueued } from "@modules/domain/lead-actions"
import type { LeadActionRequest } from "../../application/lead-action.contracts"
import type { SettleWonDealInput } from "./dto/settle-won-deal.input"
import type { LeadActionQueuedType } from "./dto/lead-action-queued.type"
import { toLeadActionQueuedType } from "./lead-action-queued.mapper"

/** Maps the bounded input and headers into the queued lead request. */
export const toSettleWonDealRequest = (
    workspaceId: string,
    input: SettleWonDealInput,
    acceptLanguage: string,
): LeadActionRequest => ({
    workspaceId,
    acceptLanguage,
    input: {
        leadId: input.leadId,
        evidence: input.evidence,
    },
})

/** Maps the queued lead job to the GraphQL acknowledgement. */
export const toSettleWonDealType = (result: LeadActionQueued): LeadActionQueuedType => toLeadActionQueuedType(result)
