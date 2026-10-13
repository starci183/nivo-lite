import { Injectable } from "@nestjs/common"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the OpenClaw copy of the agents the payload names is rebuilt (an unchanged copy only moves its check time). */
export class SyncAgentsStep implements JobStep {
    constructor(
        private readonly sync: AgentSyncService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then the installation, workspace or everything on OpenClaw the payload names is synced from Supabase into the OpenClaw workspaces.
     * The service ignores a payload of another shape.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "sync" })
        await this.sync.process(job.payload)
    }
}
