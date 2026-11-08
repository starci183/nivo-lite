import { Injectable } from "@nestjs/common"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import { MODULE_JOBS_QUEUE, RUN_MODULE_JOB } from "@modules/queues/module-jobs"
import { RunModuleJobStep } from "../../steps/run-module-job.step"

@Injectable()
/**
 * The module-jobs queue consumer, with the standard fencing. A failure is not caught: the runner marks the job failed and the queue
 * retries it through its attempts (a transient failure), or ends it (an input or code failure the owner sees as a failed job).
 */
export class ModuleJobsProcessor extends FencedProcessor {
    readonly queue: "module_jobs" = MODULE_JOBS_QUEUE
    override readonly job: "module-jobs.run" = RUN_MODULE_JOB
    /** The fence holds a connection while the claim is renewed and a job opens scoped transactions of its own; a few jobs at once keep pool capacity. */
    override readonly concurrency = 2

    constructor(private readonly step: RunModuleJobStep) {
        super()
    }

    /** Runs the job step under the runner's claim. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
