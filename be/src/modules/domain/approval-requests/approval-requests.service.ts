import { Injectable } from "@nestjs/common"
import type {
    ApprovalProgress,
    ApprovalSweep,
    DecideApprovalParams,
    OpenApprovalParams,
    OpenedApproval,
} from "./approval-requests.contracts"
import { ApprovalDecidingService } from "./approval-deciding.service"
import { ApprovalOpeningService } from "./approval-opening.service"
import { ApprovalSweepService } from "./approval-sweep.service"

@Injectable()
/**
 * The requests for approval of the steps an agent cannot finish alone: who may approve (the rule's group that the members' grants
 * cover), how they decide (any one, all, in order), the lock that makes the first of "any one" win, the clock that ends a request
 * and the hand-over to the owner of the agent. The work chain reaches the capability through this one door.
 */
export class ApprovalRequestsService {
    constructor(
        private readonly opening: ApprovalOpeningService,
        private readonly deciding: ApprovalDecidingService,
        private readonly sweeping: ApprovalSweepService,
    ) {}

    /** Opens the request of a chain step and answers who is asked, who was left out and when it runs out. */
    open(params: OpenApprovalParams): Promise<OpenedApproval> {
        return this.opening.open(params)
    }

    /** Takes the verdict of a member on a request, after proving their right again. */
    decide(params: DecideApprovalParams): Promise<ApprovalProgress> {
        return this.deciding.decide(params)
    }

    /** The minute tick: expires the requests whose time ran out and reminds the approvers of the ones half-way. */
    sweep(): Promise<ApprovalSweep> {
        return this.sweeping.sweep()
    }
}
