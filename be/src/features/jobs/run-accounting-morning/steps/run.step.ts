import { Injectable } from "@nestjs/common"
import { DeskDailyService } from "@modules/domain/accounting"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** Runs the accounting morning for every workspace with a tax profile; each workspace posts its card once per day. */
export class RunAccountingMorningStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        @InjectJobClaims() claims: JobClaims,
        private readonly daily: DeskDailyService,
    ) {
        super(claims, "run")
    }

    /** Runs the morning after the claim is checked; a repeat the same day posts nothing new. */
    protected perform(): Promise<unknown> {
        return this.daily.runAll()
    }
}
