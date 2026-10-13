import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { ZALO_WIZARD_QUEUE } from "@modules/queues/zalo-wizard"
import { WizardStep } from "../../steps/wizard.step"

@Injectable()
/** The processor of the run-zalo-wizard job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class RunZaloWizardProcessor extends FencedProcessor {
    readonly queue = ZALO_WIZARD_QUEUE

    constructor(private readonly wizard: WizardStep) {
        super()
    }

    /** Runs the wizard command; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.wizard.run(job)
    }
}
