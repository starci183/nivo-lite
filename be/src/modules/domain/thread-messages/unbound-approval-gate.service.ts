import { Injectable } from "@nestjs/common"
import { ThreadMessagesError, ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import type { ApprovalDecisionResult, OpenedApproval } from "./thread-messages.contracts"
import type { ApprovalGate } from "./thread-messages.port"

@Injectable()
/** The approval gate of an app where the approval capability is not bound: it refuses every ask and decision with a typed error. */
export class UnboundApprovalGateService implements ApprovalGate {
    /** No request can be opened: the approval capability is not bound. */
    open(): Promise<OpenedApproval> {
        return Promise.reject(new ThreadMessagesError({ code: ThreadMessagesErrorCode.ApprovalUnbound }))
    }

    /** No verdict can be recorded: the approval capability is not bound. */
    decide(): Promise<ApprovalDecisionResult> {
        return Promise.reject(new ThreadMessagesError({ code: ThreadMessagesErrorCode.ApprovalUnbound }))
    }
}
