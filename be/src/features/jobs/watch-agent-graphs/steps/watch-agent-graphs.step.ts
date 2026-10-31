import { Injectable } from "@nestjs/common"
import { AgentGraphWatchService } from "@modules/domain/agent-graphs"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: seeds the graphs that are missing, raises what ended decisions teach, and compares the Brain rules behind the graphs. */
export class WatchAgentGraphsStep implements JobStep {
    constructor(
        private readonly watch: AgentGraphWatchService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then runs the passes. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "watch" })
        await this.watch.tick()
    }
}
