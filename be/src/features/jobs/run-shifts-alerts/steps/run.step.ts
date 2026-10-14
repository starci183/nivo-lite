import { Injectable } from "@nestjs/common"
import { ShiftsAlertsService } from "@modules/domain/shifts"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** Runs one shift-alerts job through the shifts capability: the minute tick, a reminder or a no-show check. */
export class RunShiftsAlertsStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        @InjectJobClaims() claims: JobClaims,
        private readonly alerts: ShiftsAlertsService,
    ) {
        super(claims, "run")
    }

    /** Runs the alert after the claim is checked; each job re-checks its shift, so a repeat is safe. */
    protected perform(payload: object): Promise<unknown> {
        return this.alerts.runJob(payload)
    }
}
