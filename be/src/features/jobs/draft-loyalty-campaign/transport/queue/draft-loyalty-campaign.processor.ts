import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { AGENTS_QUEUE } from "@modules/queues/agents"
import { DRAFT_LOYALTY_CAMPAIGN_JOB } from "@modules/queues/loyalty-campaign"
import { DraftLoyaltyCampaignStep } from "../../steps/draft-loyalty-campaign.step"

@Injectable()
/** Routes only campaign draft jobs from the existing agents queue into the fenced step. */
export class DraftLoyaltyCampaignProcessor extends FencedProcessor {
    readonly queue = AGENTS_QUEUE
    override readonly job = DRAFT_LOYALTY_CAMPAIGN_JOB

    constructor(private readonly draft: DraftLoyaltyCampaignStep) {
        super()
    }

    /** The runner owns claim and settlement; the step owns the draft. */
    async process(job: ClaimedJob): Promise<void> {
        await this.draft.run(job)
    }

    /** Records failure once retries are exhausted. */
    override async onFailed(delivery: QueueDelivery): Promise<void> {
        await this.draft.abandon(delivery.payload)
    }
}
