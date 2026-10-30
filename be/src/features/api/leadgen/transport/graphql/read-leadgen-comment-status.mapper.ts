import type { LeadGenCommentStatus } from "../../application/leadgen-comment.contracts"
import type { ReadLeadGenCommentStatusRequest } from "../../application/read-leadgen-comment-status.contracts"
import type { ReadLeadGenCommentStatusInput } from "./dto/read-leadgen-comment-status.input"
import type { LeadGenCommentStatusType } from "./dto/leadgen-comment-status.type"

/** Keeps the work-item lookup inside the selected workspace. */
export const toReadLeadGenCommentStatusRequest = (
    workspaceId: string,
    input: ReadLeadGenCommentStatusInput,
): ReadLeadGenCommentStatusRequest => ({
    workspaceId,
    workItemId: input.workItemId,
})

/** Maps current approval job progress to GraphQL. */
export const toLeadGenCommentStatusType = (result: LeadGenCommentStatus): LeadGenCommentStatusType => ({ ...result })
