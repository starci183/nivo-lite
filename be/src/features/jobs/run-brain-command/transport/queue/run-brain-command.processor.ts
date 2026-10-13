import { Injectable } from "@nestjs/common"
import { BrainCommandRunnerService } from "@modules/domain/brain"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { KNOWLEDGE_QUEUE, KnowledgeJob } from "@modules/queues/knowledge"
import { RunCommandStep } from "../../steps/run-command.step"

@Injectable()
/** The processor of the run-brain-command job: the runner claims and settles it; `process` delegates to the one step. */
export class RunBrainCommandProcessor extends FencedProcessor {
    override readonly queue = KNOWLEDGE_QUEUE
    override readonly job = KnowledgeJob.BrainCommand

    constructor(
        private readonly runCommand: RunCommandStep,
        private readonly runner: BrainCommandRunnerService,
    ) {
        super()
    }

    /** Carries out the command; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.runCommand.run(job)
    }

    /** The job ended as failed: the command row says so. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.runner.giveUp(delivery.payload)
    }
}
