import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { DECISIONS_QUEUE } from "@modules/queues/decisions"
import { DecisionsStep } from "../../steps/decisions.step"

@Injectable()
/** Consumes every job of the decisions queue (a decision, an Office command) and runs its one step. */
export class DecisionsProcessor extends FencedProcessor {
    readonly queue = DECISIONS_QUEUE

    constructor(private readonly step: DecisionsStep) {
        super()
    }

    /** Runs the one step of the job. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
