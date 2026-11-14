import { Injectable } from "@nestjs/common"
import { BrainPolicyDeriveService } from "@modules/domain/brain"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { KNOWLEDGE_QUEUE, KnowledgeJob } from "@modules/queues/knowledge"
import { DerivePoliciesStep } from "../../steps/derive-policies.step"

@Injectable()
/** The processor of the derive-brain-policies job: the runner claims and settles it; `process` delegates to the one step. */
export class DeriveBrainPoliciesProcessor extends FencedProcessor {
    override readonly queue: "knowledge" = KNOWLEDGE_QUEUE
    override readonly job: KnowledgeJob.PolicyDerive = KnowledgeJob.PolicyDerive

    constructor(
        private readonly derivePolicies: DerivePoliciesStep,
        private readonly derive: BrainPolicyDeriveService,
    ) {
        super()
    }

    /** Derives; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.derivePolicies.run(job)
    }

    /** The job ended as failed (the retries ran out): the derive state of the workspace says so, for the tab. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.derive.giveUp(delivery.payload)
    }
}
