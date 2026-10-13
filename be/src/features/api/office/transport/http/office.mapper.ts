import type {
    ApprovalView,
    CandidateView,
    ConfirmResult,
    MessagePage,
    ProposeOutcome,
} from "@modules/domain/office-command-candidates"
import type { ListThreadMessagesRequest as ThreadQueryRequest } from "../../application/list-thread-messages.contracts"
import type { ApprovalResponse } from "./dto/approval.response"
import type { CandidateResponse } from "./dto/candidate.response"
import type { ConfirmResultResponse } from "./dto/confirm-result.response"
import type { ListThreadMessagesRequest } from "./dto/list-thread-messages.request"
import type { MessagePageResponse } from "./dto/message-page.response"
import type { ProposeOutcomeResponse } from "./dto/propose-outcome.response"

/** Maps the thread listing of the HTTP request, with the workspace it names, to the query request. */
export const toThreadQueryRequest = (workspaceId: string, input: ListThreadMessagesRequest): ThreadQueryRequest => ({
    workspaceId,
    before: input.before,
    limit: input.limit,
})

/** Maps one command card to its response. */
export const toCandidateResponse = (view: CandidateView): CandidateResponse => ({ ...view })

/** Maps the command cards of the workspace to their responses. */
export const toCandidatesResponse = (views: ReadonlyArray<CandidateView>): Array<CandidateResponse> =>
    views.map(toCandidateResponse)

/** Maps what proposing answered to its response. */
export const toProposeOutcomeResponse = (outcome: ProposeOutcome): ProposeOutcomeResponse => ({ ...outcome })

/** Maps what confirming did to its response. */
export const toConfirmResultResponse = (result: ConfirmResult): ConfirmResultResponse => ({ ...result })

/** Maps one page of the thread to its response. */
export const toMessagePageResponse = (page: MessagePage): MessagePageResponse => ({ ...page })

/** Maps approval cards to their responses. */
export const toApprovalsResponse = (views: ReadonlyArray<ApprovalView>): Array<ApprovalResponse> =>
    views.map((view) => ({ ...view }))
