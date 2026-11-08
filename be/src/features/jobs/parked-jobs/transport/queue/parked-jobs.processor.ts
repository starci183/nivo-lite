import { Injectable } from "@nestjs/common"
import { FencedProcessor, PARKED_JOBS_SWEEP, type ClaimedJob } from "@modules/platform/jobs"
import { SweepParkedJobsStep } from "../../steps/sweep-parked-jobs.step"

@Injectable()
/** The consumer of the 15-minute sweep tick and of the boot request, with the standard fencing. */
export class ParkedJobsProcessor extends FencedProcessor {
    readonly queue: "parked_jobs_sweep" = PARKED_JOBS_SWEEP.queue
    override readonly job: "parked-jobs.sweep" = PARKED_JOBS_SWEEP.job

    constructor(private readonly sweep: SweepParkedJobsStep) {
        super()
    }

    /** Runs the sweep step under the runner's claim. */
    async process(job: ClaimedJob): Promise<void> {
        await this.sweep.run(job)
    }
}
