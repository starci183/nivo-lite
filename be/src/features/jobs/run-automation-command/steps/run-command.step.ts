import { Injectable } from "@nestjs/common"
import { AutomationCommandsService } from "@modules/domain/automation-commands"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the command a manager queued from the screen, run and answered on its row. */
export class RunCommandStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        private readonly commands: AutomationCommandsService,
        @InjectJobClaims() claims: JobClaims,
    ) {
        super(claims, "command")
    }

    /** Executes the command after the worker's claim has been checked. */
    protected perform(payload: object): Promise<unknown> {
        return this.commands.execute(payload)
    }
}
