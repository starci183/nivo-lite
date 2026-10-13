import type { LeadActionQueued } from "@modules/domain/lead-actions"
import type { LeadActionRequest } from "../../application/lead-action.contracts"
import type { RefreshLeadContextInput } from "./dto/refresh-lead-context.input"
import type { LeadActionQueuedType } from "./dto/lead-action-queued.type"
import { toLeadActionQueuedType } from "./lead-action-queued.mapper"

/** Maps the bounded input and headers into the queued lead request. */
export const toRefreshLeadContextRequest = (
    workspaceId: string,
    input: RefreshLeadContextInput,
    acceptLanguage: string,
): LeadActionRequest => ({
    workspaceId,
    acceptLanguage,
    input: {
        leadId: input.leadId,
    },
})

/** Maps the queued lead job to the GraphQL acknowledgement. */
export const toRefreshLeadContextType = (result: LeadActionQueued): LeadActionQueuedType =>
    toLeadActionQueuedType(result)
