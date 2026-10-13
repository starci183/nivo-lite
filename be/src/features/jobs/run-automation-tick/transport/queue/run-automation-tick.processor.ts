import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { AUTOMATION_QUEUE, AUTOMATION_TICK_JOB } from "@modules/queues/automation"
import { RunAutomationTickStep } from "../../steps/tick.step"

@Injectable()
/** The processor of the minute tick: the platform scheduler enqueues it, the one step runs the due and retried runs. */
export class RunAutomationTickProcessor extends FencedProcessor {
    readonly queue = AUTOMATION_QUEUE
    override readonly job = AUTOMATION_TICK_JOB

    constructor(private readonly step: RunAutomationTickStep) {
        super()
    }

    /** Runs the one step; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
