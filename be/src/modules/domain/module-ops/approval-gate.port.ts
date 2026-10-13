import type { ApprovalDecision, ApprovalRequest, ApprovalResult } from "./module-ops.contracts"

/** The authority gate: the owner's rule decides whether an action runs at once or waits for a person. It is also the injection token. */
export abstract class ApprovalGate {
    /** Asks the gate to decide an action; the answer is `done` when it ran and `waiting_decision` when a person must decide. */
    abstract request(request: ApprovalRequest): Promise<ApprovalResult>
    /** Records a person's decision about a waiting work item and runs or drops the action; a work item no longer waiting answers its current status. */
    abstract decide(decision: ApprovalDecision): Promise<ApprovalResult>
}
