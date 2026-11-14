import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DocumentCriticService } from "./document-critic.service"
import { DossierReviewLogEvent } from "./dossier-review.log-events"
import { DossierReviewRunnerService } from "./dossier-review-runner.service"
import { DossierReviewRunsService } from "./dossier-review-runs.service"
import { DossierReviewRunEntity } from "./persistence/entities"
import { ReviewCriticService } from "./review-critic.service"

const WS = "11111111-1111-4111-8111-111111111111"
const NOW = "2026-10-31T10:00:00.000Z"
const PAYLOAD = { runId: "r1", workspaceId: WS }

/** A run row in a state, started at an instant. */
const runOf = (status: DossierReviewRunEntity["status"], startedAt: Date | null = null): DossierReviewRunEntity =>
    Object.assign(new DossierReviewRunEntity(), {
        id: "r1",
        workspaceId: WS,
        scope: "workspace",
        dossierId: null,
        trigger: "document",
        triggerRef: "s1",
        status,
        requestedBy: null,
        aiState: null,
        stats: {},
        error: null,
        startedAt,
        finishedAt: null,
    })

const build = async (run: DossierReviewRunEntity | null = runOf("queued")) => {
    const tx = fakeTransaction(
        mockEntityManager({
            findOne: [DossierReviewRunEntity, run],
            update: [DossierReviewRunEntity, { affected: 1 }],
        }),
    )
    const em: MockEntityManager = tx.em
    const logger = mock<Logger>()
    const critic = mock<ReviewCriticService>()
    const documentCritic = mock<DocumentCriticService>({
        runWaiting: jest.fn().mockResolvedValue(0),
        hasWaiting: jest.fn().mockResolvedValue(false),
    })
    const runs = mock<DossierReviewRunsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DossierReviewRunnerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: ReviewCriticService, useValue: critic },
            { provide: DocumentCriticService, useValue: documentCritic },
            { provide: DossierReviewRunsService, useValue: runs },
        ],
    }).compile()
    return { service: moduleRef.get(DossierReviewRunnerService), em, logger, critic, documentCritic, runs }
}

describe("DossierReviewRunnerService run: the claim", () => {
    it("drops a payload of another shape", async () => {
        const { service, logger, em } = await build()

        await expect(service.run({ draftId: "x" })).resolves.toBe("skipped")
        expect(logger.warn).toHaveBeenCalledWith(DossierReviewLogEvent.PayloadRefused, { job: "review" })
        expect(em.transaction).not.toHaveBeenCalled()
    })

    it("skips a run that is gone, ended, or held by a live worker, and still lets its documents go on", async () => {
        const recent = new Date("2026-10-31T09:55:00.000Z")
        for (const run of [null, runOf("done"), runOf("running", recent)]) {
            const { service, critic, documentCritic } = await build(run)
            await expect(service.run(PAYLOAD)).resolves.toBe("skipped")
            expect(documentCritic.runWaiting).not.toHaveBeenCalled()
            expect(critic.settle).toHaveBeenCalledWith(WS, "r1")
        }
    })

    it("claims a queued run, or a running one whose worker has been silent, runs the critiques and ends it done", async () => {
        for (const run of [runOf("queued"), runOf("running", null), runOf("running", new Date("2026-10-31T09:00:00.000Z"))]) {
            const { service, em, critic, documentCritic } = await build(run)
            await expect(service.run(PAYLOAD)).resolves.toBe("done")
            expect(em.update).toHaveBeenNthCalledWith(
                1,
                DossierReviewRunEntity,
                { id: "r1", workspaceId: WS },
                { status: "running", startedAt: new Date(NOW) },
            )
            expect(em.update).toHaveBeenNthCalledWith(
                2,
                DossierReviewRunEntity,
                { id: "r1", workspaceId: WS },
                { status: "done", finishedAt: new Date(NOW) },
            )
            expect(documentCritic.runWaiting).toHaveBeenCalledWith(WS)
            expect(critic.settle).toHaveBeenCalledWith(WS, "r1")
        }
    })
})

describe("DossierReviewRunnerService run: the follow-up (D-V-3)", () => {
    it("queues a follow-up run when shop-document critiques still wait after its batch", async () => {
        const { service, documentCritic, runs } = await build()
        documentCritic.runWaiting.mockResolvedValue(2)
        documentCritic.hasWaiting.mockResolvedValue(true)

        await service.run(PAYLOAD)

        expect(runs.continueCritiques).toHaveBeenCalledWith(WS)
    })

    it("never spins: a batch that ran nothing queues none, and a critique that ended without progress asks for none", async () => {
        const idle = await build()
        idle.documentCritic.runWaiting.mockResolvedValue(0)
        idle.documentCritic.hasWaiting.mockResolvedValue(true)
        await idle.service.run(PAYLOAD)
        expect(idle.runs.continueCritiques).not.toHaveBeenCalled()

        const spent = await build()
        spent.documentCritic.runWaiting.mockResolvedValue(1)
        spent.documentCritic.hasWaiting.mockResolvedValue(false)
        await spent.service.run(PAYLOAD)
        expect(spent.runs.continueCritiques).not.toHaveBeenCalled()
    })
})

describe("DossierReviewRunnerService fail", () => {
    it("ends a queued or running run failed, still runs the critiques, and ignores a payload of another shape", async () => {
        const { service, em, critic, documentCritic } = await build()

        await service.fail({ nope: true })
        await service.fail(PAYLOAD)

        expect(em.update).toHaveBeenCalledTimes(1)
        expect(em.update).toHaveBeenCalledWith(
            DossierReviewRunEntity,
            { id: "r1", workspaceId: WS, status: In(["queued", "running"]) },
            { status: "failed", finishedAt: new Date(NOW), error: "job_failed" },
        )
        expect(documentCritic.runWaiting).toHaveBeenCalledTimes(1)
        expect(critic.settle).toHaveBeenCalledWith(WS, "r1")
    })
})
