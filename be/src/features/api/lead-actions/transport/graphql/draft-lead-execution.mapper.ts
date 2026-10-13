import type { LeadActionQueued } from "@modules/domain/lead-actions"
import type { LeadActionRequest } from "../../application/lead-action.contracts"
import type { DraftLeadExecutionInput } from "./dto/draft-lead-execution.input"
import type { LeadActionQueuedType } from "./dto/lead-action-queued.type"
import { toLeadActionQueuedType } from "./lead-action-queued.mapper"

/** Maps the bounded input and headers into the queued lead request. */
export const toDraftLeadExecutionRequest = (
    workspaceId: string,
    input: DraftLeadExecutionInput,
    acceptLanguage: string,
): LeadActionRequest => ({
    workspaceId,
    acceptLanguage,
    input: {
        responsibilityId: input.responsibilityId,
    },
})

/** Maps the queued lead job to the GraphQL acknowledgement. */
export const toDraftLeadExecutionType = (result: LeadActionQueued): LeadActionQueuedType =>
    toLeadActionQueuedType(result)
