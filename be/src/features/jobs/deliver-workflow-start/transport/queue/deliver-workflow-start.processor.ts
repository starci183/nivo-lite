import { Injectable } from "@nestjs/common"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import { WORKFLOW_START_QUEUE, WorkflowStartJob } from "@modules/queues/workflow-start"
import { DeliverStartStep } from "../../steps/deliver-start.step"

/** How many starts one process delivers at once: each is its own event under its own once-key, so they do not wait on each other. */
const DELIVER_CONCURRENCY = 4

@Injectable()
/** The processor of the deliver job of the workflow-start queue: the runner claims and settles it; `process` delegates to the one step. */
export class DeliverWorkflowStartProcessor extends FencedProcessor {
    readonly queue: "workflow_start" = WORKFLOW_START_QUEUE

    override readonly job: WorkflowStartJob.Deliver = WorkflowStartJob.Deliver

    override readonly concurrency: 4 = DELIVER_CONCURRENCY

    constructor(private readonly deliver: DeliverStartStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.deliver.run(job)
    }
}
