import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { AGENTS_QUEUE, AgentsJob } from "@modules/queues/agents"
import { RunSetupTurnStep } from "../../steps/run-setup-turn.step"

@Injectable()
/** The processor of the run-setup-turn job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class RunSetupTurnProcessor extends FencedProcessor {
    readonly queue = AGENTS_QUEUE

    override readonly job = AgentsJob.SetupTurn

    constructor(private readonly step: RunSetupTurnStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }

    /** The attempts are used up: the owner gets the busy message once. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.step.abandon(delivery.payload)
    }
}
