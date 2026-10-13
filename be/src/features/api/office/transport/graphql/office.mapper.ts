import type {
    ApprovalView,
    CandidateView,
    ConfirmResult,
    MessagePage,
    ProposeOutcome,
} from "@modules/domain/office-command-candidates"
import type { Locale } from "@modules/platform/i18n"
import type { CancelCommandRequest } from "../../application/cancel-command.contracts"
import type { ConfirmCommandRequest } from "../../application/confirm-command.contracts"
import type { ListThreadMessagesRequest } from "../../application/list-thread-messages.contracts"
import type { ProposeCommandRequest } from "../../application/propose-command.contracts"
import type { ListOfficeMessagesInput } from "./dto/list-office-messages.input"
import type { OfficeAckType } from "./dto/office-ack.type"
import type { OfficeApprovalType } from "./dto/office-approval.type"
import type { OfficeCandidateIdInput } from "./dto/office-candidate-id.input"
import type { OfficeCandidateType } from "./dto/office-candidate.type"
import type { OfficeConfirmResultType } from "./dto/office-confirm-result.type"
import type { OfficeMessagePageType } from "./dto/office-message-page.type"
import type { OfficeProposeOutcomeType } from "./dto/office-propose-outcome.type"
import type { ProposeOfficeCommandInput } from "./dto/propose-office-command.input"

/** The request of a query that names only the workspace. */
export interface WorkspaceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}

/** Maps the workspace of the request to a request that names only it. */
export const toWorkspaceRequest = (workspaceId: string): WorkspaceRequest => ({ workspaceId })

/** Maps the thread listing of the GraphQL input, with the workspace it names, to the query request. */
export const toThreadQueryRequest = (
    workspaceId: string,
    input: ListOfficeMessagesInput,
): ListThreadMessagesRequest => ({
    workspaceId,
    ...input,
})

/** Maps the proposal of the GraphQL input, with the workspace and the locale, to the command request. */
export const toProposeCommandRequest = (
    workspaceId: string,
    input: ProposeOfficeCommandInput,
    locale: Locale,
): ProposeCommandRequest => ({ workspaceId, locale, ...input })

/** Maps the confirmation of the GraphQL input, with the workspace and the locale, to the command request. */
export const toConfirmCommandRequest = (
    workspaceId: string,
    input: OfficeCandidateIdInput,
    locale: Locale,
): ConfirmCommandRequest => ({ workspaceId, locale, ...input })

/** Maps the cancellation of the GraphQL input, with the workspace, to the command request. */
export const toCancelCommandRequest = (workspaceId: string, input: OfficeCandidateIdInput): CancelCommandRequest => ({
    workspaceId,
    ...input,
})

/** Maps approval cards to the GraphQL type. */
export const toOfficeApprovalsType = (views: ReadonlyArray<ApprovalView>): Array<OfficeApprovalType> =>
    views.map((view) => ({ ...view }))

/** Maps the command cards of the workspace to the GraphQL type. */
export const toOfficeCandidatesType = (views: ReadonlyArray<CandidateView>): Array<OfficeCandidateType> =>
    views.map((view) => ({ ...view }))

/** Maps what proposing answered to the GraphQL type. */
export const toOfficeProposeOutcomeType = (outcome: ProposeOutcome): OfficeProposeOutcomeType => ({ ...outcome })

/** Maps what confirming did to the GraphQL type. */
export const toOfficeConfirmResultType = (result: ConfirmResult): OfficeConfirmResultType => ({ ...result })

/** Maps one page of the thread to the GraphQL type. */
export const toOfficeMessagePageType = (page: MessagePage): OfficeMessagePageType => ({ ...page })

/** The answer of a mutation that returns nothing else. */
export const toOfficeAckType = (): OfficeAckType => ({ ok: true })
