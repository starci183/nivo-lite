import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { AGENTS_QUEUE } from "@modules/queues/agents"
import { DRAFT_LOYALTY_CAMPAIGN_JOB } from "./loyalty-campaign.contracts"
import { LoyaltyCampaignQueue } from "./loyalty-campaign.queue"

const payload = { workspaceId: "ws-1", campaignId: "camp-1", generationId: "gen-1" }

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [LoyaltyCampaignQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(LoyaltyCampaignQueue), outbox }
}

describe("LoyaltyCampaignQueue", () => {
    it("writes the draft on the agents queue keyed on the campaign", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueueDraft(payload, tx)

        expect(outbox.write).toHaveBeenCalledWith(tx, AGENTS_QUEUE, payload, {
            job: DRAFT_LOYALTY_CAMPAIGN_JOB,
            dedupeKey: "loyalty.campaign.draft:camp-1",
        })
    })
})
