import { Injectable } from "@nestjs/common"
import { ModuleJobRunnerService } from "@modules/domain/entity-engine"
import { InjectJobClaims, type ClaimedJob, type JobClaims, type JobStep } from "@modules/platform/jobs"

@Injectable()
/**
 * The fenced orchestration step of one declared job. It does not hold the fence across the run (`withFence` keeps a connection while its
 * work runs, and a job may call the door): every write of the run is guarded by the entity engine's own scoped transactions, and every
 * remote effect is claimed in the inbox under the job's effect key.
 */
export class RunModuleJobStep implements JobStep {
    constructor(
        private readonly runner: ModuleJobRunnerService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Proves the worker fence before any effect, then runs the declared job. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "module-job" })
        await this.runner.run(job)
    }
}
