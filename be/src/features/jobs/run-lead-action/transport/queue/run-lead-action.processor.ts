import { Injectable } from "@nestjs/common"
import { LeadActionsService } from "@modules/domain/lead-actions"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { LEAD_ACTIONS_QUEUE, RUN_LEAD_ACTION_JOB } from "@modules/queues/lead-actions"
import { RunLeadActionStep } from "../../steps/run-lead-action.step"

@Injectable()
/** The lead-actions queue consumer, with the standard fencing and terminal failure hook. */
export class RunLeadActionProcessor extends FencedProcessor {
    readonly queue = LEAD_ACTIONS_QUEUE
    override readonly job = RUN_LEAD_ACTION_JOB
    /** The fence holds a connection while existing owner transactions run; one action per API replica keeps pool capacity available. */
    override readonly concurrency = 1

    constructor(
        private readonly step: RunLeadActionStep,
        private readonly actions: LeadActionsService,
    ) {
        super()
    }

    /** Runs the action step under the runner's claim. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }

    /** Makes an exhausted delivery's terminal failure visible to the status query. */
    override async onFailed(delivery: QueueDelivery, cause: unknown): Promise<void> {
        await this.actions.failDelivery(delivery, cause)
    }
}
