import type { ApproveLeadGenCommentRequest, LeadGenCommentStatus } from "../../application/leadgen-comment.contracts"
import type { Locale } from "@modules/platform/i18n"
import type { ApproveLeadGenCommentInput } from "./dto/approve-leadgen-comment.input"
import type { LeadGenCommentStatusType } from "./dto/leadgen-comment-status.type"

/** Maps the public reply and the verified workspace scope to the approval command. */
export const toApproveLeadGenCommentRequest = (
    workspaceId: string,
    locale: Locale,
    input: ApproveLeadGenCommentInput,
): ApproveLeadGenCommentRequest => ({
    workspaceId,
    locale,
    workItemId: input.workItemId,
    draft: input.draft,
})

/** Maps the queued decision to its progress shape. */
export const toApprovedLeadGenCommentType = (result: LeadGenCommentStatus): LeadGenCommentStatusType => ({ ...result })
