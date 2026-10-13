import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { AGENTS_QUEUE } from "@modules/queues/agents"
import { DRAFT_LOYALTY_CAMPAIGN_JOB } from "./loyalty-campaign.contracts"
import type { LoyaltyCampaignPayload } from "./loyalty-campaign.contracts"

@Injectable()
/** Transactional producer for campaign drafting on the existing agents queue. */
export class LoyaltyCampaignQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** A campaign row, its prepared generation and its job commit together. */
    enqueueDraft(payload: LoyaltyCampaignPayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, AGENTS_QUEUE, payload, {
            job: DRAFT_LOYALTY_CAMPAIGN_JOB,
            dedupeKey: `${DRAFT_LOYALTY_CAMPAIGN_JOB}:${payload.campaignId}`,
        })
    }
}
