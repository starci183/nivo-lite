import { Injectable } from "@nestjs/common"
import { MarketingTickService } from "@modules/domain/content-ai"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"
import { marketingTickPayloadOf } from "@modules/queues/marketing-tick"

@Injectable()
/** Runs the AI Marketing tick: due Zalo OA articles are published and due weekly report cards are posted. */
export class RunMarketingTickStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        @InjectJobClaims() claims: JobClaims,
        private readonly marketing: MarketingTickService,
    ) {
        super(claims, "run")
    }

    /** Runs the tick after the claim is checked; each effect keeps its own mark, so a repeat posts nothing twice. */
    protected perform(payload: object): Promise<unknown> {
        return this.marketing.run(marketingTickPayloadOf(payload))
    }
}
