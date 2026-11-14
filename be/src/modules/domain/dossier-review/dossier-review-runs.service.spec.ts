import { Test } from "@nestjs/testing"
import { fakeIds, fakeTransaction, mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import { KnowledgeSourcesReadService, SourceCriticStageService } from "@modules/domain/knowledge-sources"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { DocumentCriticService } from "./document-critic.service"
import { DossierReviewRunsService } from "./dossier-review-runs.service"
import { DossierReviewRunEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const FIRST_ID = "00000000-0000-4000-8000-000000000001"

/** The queued workspace run with an id. */
const queuedOf = (id: string): DossierReviewRunEntity =>
    Object.assign(new DossierReviewRunEntity(), {
        id,
        workspaceId: WS,
        scope: "workspace",
        dossierId: null,
        trigger: "document",
        triggerRef: "s1",
        status: "queued",
        requestedBy: null,
    })

/** A transaction whose insert stores (or ignores) the run, and finds the queued one. */
const transactionOf = (queued: DossierReviewRunEntity) => {
    const tx = fakeTransaction(mockEntityManager({ findOneOrFail: [DossierReviewRunEntity, queued] }))
    const inserts = queueQueryBuilders(tx.em, [{ execute: {} }, { execute: {} }, { execute: {} }])
    return { tx, inserts }
}

const build = async (em: MockEntityManager) => {
    const sources = mock<KnowledgeSourcesReadService>()
    sources.briefsOf.mockResolvedValue([{ id: "s1", kind: "text", title: "Menu", topic: null }])
    const queue = mock<KnowledgeQueue>()
    const critic = mock<SourceCriticStageService>()
    const documentCritic = mock<DocumentCriticService>({ request: jest.fn().mockResolvedValue(true) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DossierReviewRunsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: IDS, useValue: fakeIds() },
            { provide: KnowledgeSourcesReadService, useValue: sources },
            { provide: KnowledgeQueue, useValue: queue },
            { provide: SourceCriticStageService, useValue: critic },
            { provide: DocumentCriticService, useValue: documentCritic },
        ],
    }).compile()
    return { service: moduleRef.get(DossierReviewRunsService), sources, queue, critic, documentCritic }
}

describe("DossierReviewRunsService requestForSource", () => {
    it("asks nothing for a document that is gone", async () => {
        const { tx } = transactionOf(queuedOf(FIRST_ID))
        const { service, sources, documentCritic, queue } = await build(tx.em)
        sources.briefsOf.mockResolvedValue([])

        await service.requestForSource(WS, "s1")

        expect(sources.briefsOf).toHaveBeenCalledWith(WS, ["s1"])
        expect(documentCritic.request).not.toHaveBeenCalled()
        expect(queue.enqueueDossierReview).not.toHaveBeenCalled()
    })

    it("lets the critique wait, queues one workspace run with its job in one transaction, and puts the document at the critic stage", async () => {
        const { tx, inserts } = transactionOf(queuedOf(FIRST_ID))
        const { service, queue, critic, documentCritic } = await build(tx.em)

        await service.requestForSource(WS, "s1")

        expect(documentCritic.request).toHaveBeenCalledWith(WS, "s1", {})
        expect(inserts[0]?.callsOf("values")).toEqual([
            [
                {
                    id: FIRST_ID,
                    workspaceId: WS,
                    scope: "workspace",
                    dossierId: null,
                    trigger: "document",
                    triggerRef: "s1",
                    status: "queued",
                    requestedBy: null,
                },
            ],
        ])
        expect(inserts[0]?.callsOf("orIgnore")).toEqual([[]])
        expect(tx.em.findOneOrFail).toHaveBeenCalledWith(DossierReviewRunEntity, {
            where: { workspaceId: WS, status: "queued", dossierId: IsNull() },
        })
        expect(queue.enqueueDossierReview).toHaveBeenCalledWith({ runId: FIRST_ID, workspaceId: WS }, expect.anything())
        expect(critic.enter).toHaveBeenCalledWith(WS, "s1")
        expect(tx.commits).toBe(1)
    })

    it("answers the run already queued and enqueues nothing when its insert was ignored", async () => {
        const { tx } = transactionOf(queuedOf("older-run"))
        const { service, queue } = await build(tx.em)

        await service.requestForSource(WS, "s1")

        expect(queue.enqueueDossierReview).not.toHaveBeenCalled()
    })

    it("D-V-1: a RESUME of the upkeep tick keeps the critique's count, and queues nothing when the critique does not wait again", async () => {
        const { tx } = transactionOf(queuedOf(FIRST_ID))
        const { service, queue, critic, documentCritic } = await build(tx.em)

        documentCritic.request.mockResolvedValue(false)
        await service.requestForSource(WS, "s1", { resume: true })
        expect(documentCritic.request).toHaveBeenCalledWith(WS, "s1", { resume: true })
        expect(queue.enqueueDossierReview).not.toHaveBeenCalled()
        expect(critic.enter).not.toHaveBeenCalled()

        documentCritic.request.mockResolvedValue(true)
        await service.requestForSource(WS, "s1", { resume: true })
        expect(queue.enqueueDossierReview).toHaveBeenCalledTimes(1)
        expect(critic.enter).toHaveBeenCalledWith(WS, "s1")
    })
})

describe("DossierReviewRunsService continueCritiques and requestForGoneSource", () => {
    it("queues a follow-up workspace run with no document", async () => {
        const { tx, inserts } = transactionOf(queuedOf(FIRST_ID))
        const { service, queue } = await build(tx.em)

        await service.continueCritiques(WS)

        expect(inserts[0]?.callsOf("values")).toEqual([[expect.objectContaining({ triggerRef: null, scope: "workspace" })]])
        expect(queue.enqueueDossierReview).toHaveBeenCalledTimes(1)
    })

    it("lets the critic forget a deleted document and queues nothing", async () => {
        const em = mockEntityManager()
        const { service, documentCritic, queue } = await build(em)

        await service.requestForGoneSource(WS, "s1")

        expect(documentCritic.forget).toHaveBeenCalledWith(WS, "s1")
        expect(queue.enqueueDossierReview).not.toHaveBeenCalled()
    })
})
