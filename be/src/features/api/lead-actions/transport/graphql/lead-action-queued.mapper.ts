import type { LeadActionQueued } from "@modules/domain/lead-actions"
import type { LeadActionQueuedType } from "./dto/lead-action-queued.type"

/** Maps a queue acknowledgement to its public GraphQL fields. */
export const toLeadActionQueuedType = (result: LeadActionQueued): LeadActionQueuedType => ({
    id: result.id,
    status: result.status,
})
