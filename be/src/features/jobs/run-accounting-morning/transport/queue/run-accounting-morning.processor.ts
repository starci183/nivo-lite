import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { ACCOUNTING_DESK_QUEUE } from "@modules/queues/accounting-desk"
import { RunAccountingMorningStep } from "../../steps/run.step"

@Injectable()
/** The processor of the accounting morning job: the one step runs it. */
export class RunAccountingMorningProcessor extends FencedProcessor {
    readonly queue = ACCOUNTING_DESK_QUEUE

    constructor(private readonly step: RunAccountingMorningStep) {
        super()
    }

    /** Runs the one step; a stale token throws the fenced-out error before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
