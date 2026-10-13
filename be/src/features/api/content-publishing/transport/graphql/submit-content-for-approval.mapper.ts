import type { SubmitContentRequest, SubmittedContent } from "@modules/domain/content-publishing"
import type { Locale } from "@modules/platform/i18n"
import type { SubmitContentForApprovalInput } from "./dto/submit-content-for-approval.input"
import type { SubmitContentForApprovalType } from "./dto/submit-content-for-approval.type"

/** Maps the bounded selector together with trusted request context. */
export const toSubmitContentForApprovalRequest = (
    workspaceId: string,
    locale: Locale,
    input: SubmitContentForApprovalInput,
): SubmitContentRequest => ({ workspaceId, locale, id: input.id })

/** Exposes the gate address without a response envelope. */
export const toSubmitContentForApprovalType = (result: SubmittedContent): SubmitContentForApprovalType => ({
    id: result.id,
    workItemId: result.workItemId,
    status: result.status,
})
