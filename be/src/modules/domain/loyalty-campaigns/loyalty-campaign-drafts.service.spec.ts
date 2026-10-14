import { Test } from "@nestjs/testing"
import type { EntityManager } from "typeorm"
import { FakeClock, builder, fakeLock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { GenerationRunnerService, GenerationsService } from "@modules/domain/ai-generations"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { JOB_FENCE } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { LoyaltyCampaignQueue } from "@modules/queues/loyalty-campaign"
import type { CampaignDraft, CampaignParams, LoyaltyCampaignView, Segment } from "./loyalty-campaigns.contracts"
import { LoyaltyCampaignDraftsService } from "./loyalty-campaign-drafts.service"
import { LoyaltyCampaignsService } from "./loyalty-campaigns.service"

const NOW = Date.UTC(2026, 9, 12)
const ANY: Segment = { tiers: [], inactiveDays: 0, birthdayThisMonth: false, minSpendVnd: 0 }
const params: CampaignParams = {
    workspaceId: "ws-1",
    name: "Autumn",
    segment: ANY,
    brief: "10 percent",
    createdBy: "Owner",
}
const prepared: CampaignDraft = {
    campaignId: "k1",
    status: "waiting",
    recipients: 3,
    draft: "Hello {ten_khach}",
}
const viewOf = builder<LoyaltyCampaignView>({
    id: "k1",
    name: "Autumn",
    segment: ANY,
    messageDraft: "Hello {ten_khach}",
    draft: "Hello {ten_khach}",
    status: "waiting",
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
const jobOf = (payload: object): ClaimedJob => ({
    jobId: "job-1",
    kind: "loyalty.campaign.draft",
    fencingToken: 4,
    currentStep: null,
    payload,
})
const PAYLOAD = { workspaceId: "ws-1", campaignId: "k1", generationId: "gen-1" }

const build = async () => {
    const clock = new FakeClock(NOW)
    const tx = fakeTransaction(mockEntityManager())
    const entityManager = tx.em
    const campaigns = mock<LoyaltyCampaignsService>()
    const generations = mock<GenerationsService>()
    const runner = mock<GenerationRunnerService>()
    const fence = fakeLock(clock)
    Object.assign(fence, {
        write: (_job: ClaimedJob, action: (manager: EntityManager) => Promise<void>) => action(entityManager),
    })
    const queue = mock<LoyaltyCampaignQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyCampaignDraftsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
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
        clock,
        entityManager,
        campaigns,
        generations,
        runner,
        queue,
    }
}

describe("LoyaltyCampaignDraftsService", () => {
    describe("request", () => {
        it("returns the waiting campaign and queues its prepared generation in the same transaction", async () => {
            const { service, campaigns, generations, queue } = await build()
            campaigns.prepare.mockResolvedValue(prepared)
            generations.prepare.mockResolvedValue("gen-1")

            await expect(service.request(params)).resolves.toEqual(prepared)

            const manager = campaigns.prepare.mock.calls[0]?.[1]
            expect(generations.prepare).toHaveBeenCalledWith(
                expect.objectContaining({
                    workspaceId: "ws-1",
                    purpose: "loyalty_promo_draft",
                    responseFormat: "text",
                    timeoutMs: 45000,
                    kind: "engine",
                    module: "other",
                }),
                manager,
            )
            expect(queue.enqueueDraft).toHaveBeenCalledWith(
                { workspaceId: "ws-1", campaignId: "k1", generationId: "gen-1" },
                manager,
            )
        })

        it("queues a null generation when none can be prepared", async () => {
            const { service, campaigns, generations, queue } = await build()
            campaigns.prepare.mockResolvedValue(prepared)
            generations.prepare.mockResolvedValue(null)

            await expect(service.request(params)).resolves.toEqual(prepared)

            expect(queue.enqueueDraft).toHaveBeenCalledWith(
                { workspaceId: "ws-1", campaignId: "k1", generationId: null },
                campaigns.prepare.mock.calls[0]?.[1],
            )
        })
    })

    describe("run", () => {
        it("writes the model message and the time it took", async () => {
            const { service, clock, entityManager, campaigns, generations, runner } = await build()
            campaigns.get.mockResolvedValue(viewOf())
            runner.run.mockImplementation(() => {
                clock.advance(40)
                return Promise.resolve("done")
            })
            generations.progress.mockResolvedValue({
                status: "done",
                text: "{ten_khach} thanks",
                usage: null,
                timings: {},
            })

            await expect(service.run(jobOf(PAYLOAD))).resolves.toBeUndefined()

            expect(campaigns.finishDraft).toHaveBeenCalledWith(entityManager, "ws-1", "k1", "{ten_khach} thanks", 40)
        })

        it("keeps the template when the model text is unusable", async () => {
            const { service, entityManager, campaigns, generations, runner } = await build()
            campaigns.get.mockResolvedValue(viewOf())
            runner.run.mockResolvedValue("done")
            generations.progress.mockResolvedValue({ status: "done", text: "thanks", usage: null, timings: {} })

            await expect(service.run(jobOf(PAYLOAD))).resolves.toBeUndefined()

            expect(campaigns.finishDraft).toHaveBeenCalledWith(entityManager, "ws-1", "k1", "Hello {ten_khach}", 0)
        })

        it("keeps the template without calling the runner when no generation was prepared", async () => {
            const { service, entityManager, campaigns, runner } = await build()
            campaigns.get.mockResolvedValue(viewOf())

            await expect(service.run(jobOf({ ...PAYLOAD, generationId: null }))).resolves.toBeUndefined()

            expect(runner.run).not.toHaveBeenCalled()
            expect(campaigns.finishDraft).toHaveBeenCalledWith(entityManager, "ws-1", "k1", "Hello {ten_khach}", 0)
        })

        it.each([null, { status: "running", text: "{ten_khach} unfinished", usage: null, timings: {} }])(
            "keeps the template when generation progress is unavailable or unfinished: %j",
            async (progress) => {
                const { service, entityManager, campaigns, generations, runner } = await build()
                campaigns.get.mockResolvedValue(viewOf())
                runner.run.mockResolvedValue("dropped")
                generations.progress.mockResolvedValue(progress)

                await expect(service.run(jobOf(PAYLOAD))).resolves.toBeUndefined()

                expect(runner.run).toHaveBeenCalledWith({ workspaceId: "ws-1", generationId: "gen-1" })
                expect(generations.progress).toHaveBeenCalledWith("ws-1", "gen-1")
                expect(campaigns.finishDraft).toHaveBeenCalledWith(entityManager, "ws-1", "k1", "Hello {ten_khach}", 0)
            },
        )

        it("stores zero duration when the clock moves backwards during generation", async () => {
            const { service, clock, entityManager, campaigns, generations, runner } = await build()
            campaigns.get.mockResolvedValue(viewOf())
            runner.run.mockImplementation(() => {
                clock.advance(-40)
                return Promise.resolve("done")
            })
            generations.progress.mockResolvedValue({
                status: "done",
                text: "{ten_khach} thanks",
                usage: null,
                timings: {},
            })

            await expect(service.run(jobOf(PAYLOAD))).resolves.toBeUndefined()

            expect(campaigns.finishDraft).toHaveBeenCalledWith(entityManager, "ws-1", "k1", "{ten_khach} thanks", 0)
        })

        it("does nothing for a payload that is not a campaign or a campaign that is not waiting", async () => {
            const { service, campaigns, runner } = await build()
            campaigns.get.mockResolvedValue(viewOf({ status: "draft" }))

            await expect(service.run(jobOf({}))).resolves.toBeUndefined()
            await expect(service.run(jobOf(PAYLOAD))).resolves.toBeUndefined()

            expect(campaigns.get).toHaveBeenCalledTimes(1)
            expect(campaigns.get).toHaveBeenCalledWith("ws-1", "k1")
            expect(runner.run).not.toHaveBeenCalled()
            expect(campaigns.finishDraft).not.toHaveBeenCalled()
        })
    })

    describe("abandon", () => {
        it("marks the campaign failed", async () => {
            const { service, campaigns } = await build()

            await expect(service.abandon(PAYLOAD)).resolves.toBeUndefined()

            expect(campaigns.failDraft).toHaveBeenCalledWith("ws-1", "k1")
        })

        it("ignores a payload that is not a campaign", async () => {
            const { service, campaigns } = await build()

            await expect(service.abandon({})).resolves.toBeUndefined()

            expect(campaigns.failDraft).not.toHaveBeenCalled()
        })
    })
})
