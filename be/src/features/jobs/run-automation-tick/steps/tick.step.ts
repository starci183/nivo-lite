import { Injectable } from "@nestjs/common"
import { AutomationTickService } from "@modules/domain/automations"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** Runs the fenced tick through the automation capability. */
export class RunAutomationTickStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        private readonly tick: AutomationTickService,
        @InjectJobClaims() claims: JobClaims,
    ) {
        super(claims, "tick")
    }

    /** Dispatches the queued tick after the worker's claim has been checked. */
    protected perform(): Promise<unknown> {
        return this.tick.run()
    }
}
