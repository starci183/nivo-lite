// Read services lead the barrel: other capabilities import this barrel while it loads (import cycles), they must already be defined.
export {
    APPROVAL_REQUESTS_ERROR_KINDS,
    ApprovalRequestsError,
    ApprovalRequestsErrorCode,
} from "./errors/approval-requests.error"
export { APPROVAL_REQUESTS_MESSAGES } from "./messages/approval-requests.messages"
export { ApprovalRequestsModule } from "./approval-requests.module"
export { resolveApprovers } from "./approver-set.policy"
export { ApprovalRequestsService } from "./approval-requests.service"
export { ApprovalRequestsReadService } from "./approval-requests-read.service"
export type { RequestStanding } from "./approval-requests-read.contracts"
export type { BranchApproval, OpenApprovalParams } from "./approval-requests.contracts"
export type { ApprovalRequestRecord, ApprovalVerdictRecord } from "./approval-requests.contracts"
export { approvalRequestsEntities } from "./persistence/entities"
