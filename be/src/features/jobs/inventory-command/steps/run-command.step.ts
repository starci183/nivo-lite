import { Injectable } from "@nestjs/common"
import { InventoryCommandService } from "@modules/domain/inventory"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the command a member submitted runs through its domain service and its answer is written on the command row. */
export class RunCommandStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly commands: InventoryCommandService,
    ) {}

    /** Records the step with the token this worker holds first, so a stale token stops here; then runs the command (a settled command is never run twice). */
    async run(job: ClaimedJob): Promise<void> {
        const { jobId, fencingToken, payload } = job
        await this.claims.advance({ jobId, expectedFencingToken: fencingToken, step: "run-command" })
        await this.commands.runJob(payload)
    }
}
