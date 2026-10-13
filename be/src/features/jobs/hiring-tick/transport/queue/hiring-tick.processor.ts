import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { HIRING_TICK_QUEUE } from "@modules/queues/hiring-tick"
import { RunHiringTickStep } from "../../steps/run-hiring-tick.step"

@Injectable()
/** The processor of the hiring-tick job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class HiringTickProcessor extends FencedProcessor {
    readonly queue = HIRING_TICK_QUEUE

    constructor(private readonly tick: RunHiringTickStep) {
        super()
    }

    /** Ticks the workspace; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.tick.run(job)
    }
}
