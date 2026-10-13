import { Injectable } from "@nestjs/common"
import { GenerationRunnerService } from "@modules/domain/ai-generations"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the queued generation runs on OpenClaw and its answer, or its failure, is written on the row (it never retries). */
export class GenerateWithAgentStep implements JobStep {
    constructor(
        private readonly runner: GenerationRunnerService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then the queued generation the payload names runs once on the internal OpenClaw agent and its text lands on the row the caller waits on.
     * The service ignores a payload of another shape.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "generate" })
        await this.runner.runJob(job)
    }
}
