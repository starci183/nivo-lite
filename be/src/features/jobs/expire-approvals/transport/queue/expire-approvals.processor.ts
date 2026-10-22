import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { DECISIONS_QUEUE, DecisionsJob } from "@modules/queues/decisions"
import { ExpireApprovalsStep } from "../../steps/expire-approvals.step"

@Injectable()
/** The processor of the approvals tick of the decisions queue: the runner claims and settles it; `process` delegates to the one step. */
export class ExpireApprovalsProcessor extends FencedProcessor {
    readonly queue = DECISIONS_QUEUE

    override readonly job = DecisionsJob.ExpireApprovals

    constructor(private readonly step: ExpireApprovalsStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
