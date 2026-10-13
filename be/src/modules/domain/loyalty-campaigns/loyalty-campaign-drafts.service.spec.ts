import { Test } from "@nestjs/testing"
import { FakeClock, fakeLock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { GenerationRunnerService, GenerationsService } from "@modules/domain/ai-generations"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ClaimedJob } from "@modules/platform/jobs"
import { LoyaltyCampaignQueue } from "@modules/queues/loyalty-campaign"
import type { CampaignDraft, CampaignParams, LoyaltyCampaignView, Segment } from "./loyalty-campaigns.contracts"
import { LoyaltyCampaignDraftsService } from "./loyalty-campaign-drafts.service"
import { LoyaltyCampaignsService } from "./loyalty-campaigns.service"
import { campaignDraftPrompt } from "./policies/campaign-draft.policy"

const NOW = Date.UTC(2026, 9, 12)
const SEGMENT: Segment = { tiers: [], inactiveDays: 0, birthdayThisMonth: false, minSpendVnd: 0 }
const PARAMS: CampaignParams = {
    workspaceId: "ws-1",
    name: "Autumn",
    segment: SEGMENT,
    brief: "10 percent off",
    createdBy: "Owner",
}
const WAITING: CampaignDraft = {
    campaignId: "k1",
    status: "waiting",
    recipients: 3,
    draft: "Spa template {ten_khach}",
}

const jobOf = (payload: object): ClaimedJob => ({
    jobId: "j-1",
    kind: "loyalty.campaign.draft",
    fencingToken: 4,
    currentStep: null,
    payload,
})

const viewOf = (status: string): LoyaltyCampaignView => ({
    id: "k1",
    name: "Autumn",
    segment: SEGMENT,
    messageDraft: WAITING.draft,
    draft: WAITING.draft,
    status,
    workItemId: null,
    recipients: 3,
    sent: 0,
    queued: 0,
    failed: 0,
    skipped: 0,
    draftMs: null,
    createdBy: "Owner",
    createdAt: "2026-10-12T00:00:00.000Z",
    finishedAt: null,
    errorCode: null,
})

type JobsDecorators = typeof import("@modules/platform/jobs/jobs.decorators")

const build = async () => {
    const jobs: JobsDecorators = await import("@modules/platform/jobs/jobs.decorators")
    const JOB_FENCE: typeof jobs.JOB_FENCE = jobs.JOB_FENCE
    const entityManager = mockEntityManager()
    const transaction = fakeTransaction(entityManager)
    const clock = new FakeClock(NOW)
    const campaigns = mock<LoyaltyCampaignsService>()
    const generations = mock<GenerationsService>()
    const runner = mock<GenerationRunnerService>()
    const queue = mock<LoyaltyCampaignQueue>()
    const fence = fakeLock()
    Object.assign(fence, {
        write(_job: ClaimedJob, action: (manager: EntityManager) => Promise<void>): Promise<void> {
            return action(entityManager)
        },
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyCampaignDraftsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: transaction.em },
            { provide: CLOCK, useValue: clock },
            { provide: LoyaltyCampaignsService, useValue: campaigns },
            { provide: GenerationsService, useValue: generations },
            { provide: GenerationRunnerService, useValue: runner },
            { provide: JOB_FENCE, useValue: fence },
            { provide: LoyaltyCampaignQueue, useValue: queue },
        ],
    }).compile()
    return {
        service: moduleRef.get(LoyaltyCampaignDraftsService),
        transaction,
        clock,
        campaigns,
        generations,
        runner,
        queue,
        entityManager,
    }
}

describe("LoyaltyCampaignDraftsService", () => {
    describe("request", () => {
        it("prepares the campaign and its generation in one committed transaction", async () => {
            const { service, campaigns, generations, queue, transaction } = await build()
            campaigns.prepare.mockResolvedValue(WAITING)
            generations.prepare.mockResolvedValue("g-1")

            await expect(service.request(PARAMS)).resolves.toEqual(WAITING)

            const manager = campaigns.prepare.mock.calls[0]?.[1]
            expect(generations.prepare).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    purpose: "loyalty_promo_draft",
                    messages: campaignDraftPrompt(PARAMS, WAITING.draft),
                    responseFormat: "text",
                    timeoutMs: 45000,
                    kind: "engine",
                    module: "other",
                },
                manager,
            )
            expect(queue.enqueueDraft).toHaveBeenCalledWith(
                { workspaceId: "ws-1", campaignId: "k1", generationId: "g-1" },
                manager,
            )
            expect(transaction.commits).toBe(1)
        })

        it("enqueues a draft with no generation when none can be prepared", async () => {
            const { service, campaigns, generations, queue } = await build()
            campaigns.prepare.mockResolvedValue(WAITING)
            generations.prepare.mockResolvedValue(null)

            await service.request(PARAMS)

            expect(queue.enqueueDraft).toHaveBeenCalledWith(
                { workspaceId: "ws-1", campaignId: "k1", generationId: null },
                campaigns.prepare.mock.calls[0]?.[1],
            )
        })
    })

    describe("run", () => {
        it("ignores a delivery that is not a campaign payload", async () => {
            const { service, campaigns } = await build()

            await expect(service.run(jobOf({ campaignId: "k1" }))).resolves.toBeUndefined()

            expect(campaigns.get).not.toHaveBeenCalled()
        })

        it("leaves a campaign that is no longer waiting", async () => {
            const { service, campaigns, runner } = await build()
            campaigns.get.mockResolvedValue(viewOf("draft"))

            await service.run(jobOf({ workspaceId: "ws-1", campaignId: "k1", generationId: "g-1" }))

            expect(runner.run).not.toHaveBeenCalled()
            expect(campaigns.finishDraft).not.toHaveBeenCalled()
        })

        it("stores the cleaned model text and the elapsed time while the fence is current", async () => {
            const { service, campaigns, generations, runner, clock, entityManager } = await build()
            campaigns.get.mockResolvedValue(viewOf("waiting"))
            runner.run.mockImplementation(() => {
                clock.advance(1250)
                return Promise.resolve("done")
            })
            generations.progress.mockResolvedValue({
                status: "done",
                text: '  "Hi {ten_khach}"  ',
                usage: null,
                timings: {},
            })

            await service.run(jobOf({ workspaceId: "ws-1", campaignId: "k1", generationId: "g-1" }))

            expect(runner.run).toHaveBeenCalledWith({ workspaceId: "ws-1", generationId: "g-1" })
            expect(campaigns.finishDraft).toHaveBeenCalledWith(entityManager, "ws-1", "k1", "Hi {ten_khach}", 1250)
        })

        it("keeps the template when the generation produced nothing usable", async () => {
            const { service, campaigns, generations, runner, entityManager } = await build()
            campaigns.get.mockResolvedValue(viewOf("waiting"))
            runner.run.mockResolvedValue("done")
            generations.progress.mockResolvedValue({ status: "error", text: null, usage: null, timings: {} })

            await service.run(jobOf({ workspaceId: "ws-1", campaignId: "k1", generationId: "g-1" }))

            expect(campaigns.finishDraft).toHaveBeenCalledWith(entityManager, "ws-1", "k1", WAITING.draft, 0)
        })

        it("keeps the template when the delivery has no generation", async () => {
            const { service, campaigns, runner, entityManager } = await build()
            campaigns.get.mockResolvedValue(viewOf("waiting"))

            await service.run(jobOf({ workspaceId: "ws-1", campaignId: "k1", generationId: null }))

            expect(runner.run).not.toHaveBeenCalled()
            expect(campaigns.finishDraft).toHaveBeenCalledWith(entityManager, "ws-1", "k1", WAITING.draft, 0)
        })
    })

    describe("abandon", () => {
        it("fails the campaign named by a valid delivery", async () => {
            const { service, campaigns } = await build()

            await service.abandon({ workspaceId: "ws-1", campaignId: "k1", generationId: "g-1" })

            expect(campaigns.failDraft).toHaveBeenCalledWith("ws-1", "k1")
        })

        it("ignores a delivery that names no campaign", async () => {
            const { service, campaigns } = await build()

            await expect(service.abandon({ workspaceId: "ws-1" })).resolves.toBeUndefined()

            expect(campaigns.failDraft).not.toHaveBeenCalled()
        })
    })
})
