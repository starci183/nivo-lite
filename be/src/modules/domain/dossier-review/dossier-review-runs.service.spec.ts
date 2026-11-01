import { Test } from "@nestjs/testing"
import {
    dossierEntryOf,
    dossierSourceOf,
    findingRowOf,
    runRowOf,
    SERVICES_NOW,
    SERVICES_WORKSPACE,
} from "@tests/fixtures/builders/dossier-review-services.builder"
import { fakeIds, fakeTransaction, mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ArrayContains, IsNull } from "typeorm"
import { DossierSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { DossierReviewRunsService } from "./dossier-review-runs.service"
import { DossierReviewErrorCode } from "./errors/dossier-review.error"
import { DossierFindingEntity, DossierReviewRunEntity } from "./persistence/entities"
import { ReviewInputsService } from "./review-inputs.service"

const WS = SERVICES_WORKSPACE
const FIRST_ID = "00000000-0000-4000-8000-000000000001"
const AT = SERVICES_NOW
const dossierOf = dossierEntryOf
const sourceOf = dossierSourceOf
const QUEUED = {
    id: FIRST_ID,
    scope: "dossier",
    dossierId: "d1",
    trigger: "document",
    triggerRef: "s1",
    status: "queued",
} as const
const QUEUED_RUN = runRowOf({
    ...QUEUED,
    requestedBy: null,
    aiState: null,
    stats: {},
    startedAt: null,
    finishedAt: null,
})
const runOf = (changes: Parameters<typeof runRowOf>[0] = {}): DossierReviewRunEntity => ({ ...QUEUED_RUN, ...changes })
const findingOf = (changes: Parameters<typeof findingRowOf>[0] = {}): DossierFindingEntity =>
    findingRowOf({ id: "f1", dossierId: "d2", ...changes })

const build = async (em: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>({ idOf: jest.fn().mockResolvedValue("m1") })
    const inputs = mock<ReviewInputsService>()
    const sources = mock<DossierSourcesService>()
    const queue = mock<KnowledgeQueue>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DossierReviewRunsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: IDS, useValue: fakeIds() },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ReviewInputsService, useValue: inputs },
            { provide: DossierSourcesService, useValue: sources },
            { provide: KnowledgeQueue, useValue: queue },
        ],
    }).compile()
    return { service: moduleRef.get(DossierReviewRunsService), members, inputs, sources, queue }
}

/** A transaction in which no workspace run is queued and the insert stores the run with the first id. */
const freshRun = (run: DossierReviewRunEntity, cited: ReadonlyArray<DossierFindingEntity> = []) => {
    const tx = fakeTransaction(
        mockEntityManager({
            findOne: [DossierReviewRunEntity, null],
            findOneOrFail: [DossierReviewRunEntity, run],
            find: [DossierFindingEntity, cited],
        }),
    )
    const inserts = queueQueryBuilders(tx.em, [{ execute: {} }, { execute: {} }, { execute: {} }])
    return { tx, inserts }
}

describe("DossierReviewRunsService requestForSource", () => {
    it("asks nothing for a document that is gone", async () => {
        const { service, sources, inputs } = await build(mockEntityManager())
        sources.sourceOf.mockResolvedValue(null)

        await service.requestForSource(WS, "s1")

        expect(sources.sourceOf).toHaveBeenCalledWith(WS, "s1")
        expect(inputs.all).not.toHaveBeenCalled()
    })
})

describe("DossierReviewRunsService requestForSource filing", () => {
    it("reviews a document no dossier claims on its own, with a run of the whole set", async () => {
        const { tx, inserts } = freshRun(runOf({ scope: "workspace", dossierId: null }))
        const { service, sources, inputs, queue } = await build(tx.em)
        inputs.all.mockResolvedValue([dossierOf()])
        inputs.dossierOf.mockResolvedValue(undefined)
        sources.sourceOf.mockResolvedValue(sourceOf({ topic: "OTHER", title: "Loose notes" }))

        await service.requestForSource(WS, "s1")

        expect(sources.fileUnder).not.toHaveBeenCalled()
        expect(inserts[0]?.callsOf("values")).toEqual([
            [expect.objectContaining({ scope: "workspace", dossierId: null, trigger: "document", triggerRef: "s1" })],
        ])
        expect(queue.enqueueDossierReview).toHaveBeenCalledTimes(1)
    })

    it("files a document under the dossier its content points to, marks it, and reviews that dossier", async () => {
        const { tx, inserts } = freshRun(runOf())
        const { service, sources, inputs, queue } = await build(tx.em)
        inputs.all.mockResolvedValue([dossierOf()])
        inputs.dossierOf.mockResolvedValue(dossierOf())
        sources.sourceOf.mockResolvedValue(
            sourceOf({ topic: null, title: "Business registration", tags: ["keep", "dossier:9"] }),
        )

        await service.requestForSource(WS, "s1")

        expect(sources.fileUnder).toHaveBeenCalledWith(WS, "s1", "LEGAL FILES", ["keep", "dossier:1", "dossier:auto"])
        expect(inserts[0]?.callsOf("values")).toEqual([
            [expect.objectContaining({ scope: "dossier", dossierId: "d1" })],
        ])
        expect(queue.enqueueDossierReview).toHaveBeenCalledTimes(1)
    })

    it("keeps the owner's own filing: a document its number and category already name is not moved", async () => {
        const { tx } = freshRun(runOf())
        const { service, sources, inputs } = await build(tx.em)
        inputs.all.mockResolvedValue([dossierOf()])
        sources.sourceOf.mockResolvedValue(sourceOf({ topic: "legal files" }))

        await service.requestForSource(WS, "s1")

        expect(inputs.dossierOf).not.toHaveBeenCalled()
        expect(sources.fileUnder).not.toHaveBeenCalled()
    })

    it("queues one run of the dossier with its job in one transaction", async () => {
        const { tx, inserts } = freshRun(runOf())
        const { service, sources, inputs, queue } = await build(tx.em)
        inputs.all.mockResolvedValue([dossierOf()])
        sources.sourceOf.mockResolvedValue(sourceOf())

        await service.requestForSource(WS, "s1")

        expect(tx.em.findOne).toHaveBeenCalledWith(DossierReviewRunEntity, {
            where: { workspaceId: WS, status: "queued", dossierId: IsNull() },
        })
        expect(inserts[0]?.callsOf("values")).toEqual([
            [
                {
                    id: FIRST_ID,
                    workspaceId: WS,
                    scope: "dossier",
                    dossierId: "d1",
                    trigger: "document",
                    triggerRef: "s1",
                    status: "queued",
                    requestedBy: null,
                },
            ],
        ])
        expect(inserts[0]?.callsOf("orIgnore")).toEqual([[]])
        expect(tx.em.findOneOrFail).toHaveBeenCalledWith(DossierReviewRunEntity, {
            where: { workspaceId: WS, status: "queued", dossierId: "d1" },
        })
        expect(queue.enqueueDossierReview).toHaveBeenCalledWith({ runId: FIRST_ID, workspaceId: WS }, expect.anything())
        expect(tx.commits).toBe(1)
    })
})

describe("DossierReviewRunsService requestForGoneSource", () => {
    it("re-checks every dossier citing the document and the one its title named, in order", async () => {
        const { tx } = freshRun(runOf({ id: "other" }), [findingOf(), findingOf({ id: "f2", dossierId: null })])
        const { service, inputs, queue } = await build(tx.em)
        inputs.all.mockResolvedValue([dossierOf(), dossierOf({ id: "d3", ref: "3" })])

        await service.requestForGoneSource(WS, "s1", null, "01. Certificate")

        expect(tx.em.find).toHaveBeenCalledWith(DossierFindingEntity, {
            select: { id: true, dossierId: true },
            where: { workspaceId: WS, sourceIds: ArrayContains(["s1"]) },
            take: 500,
        })
        expect(tx.em.findOneOrFail).toHaveBeenNthCalledWith(1, DossierReviewRunEntity, {
            where: { workspaceId: WS, status: "queued", dossierId: "d1" },
        })
        expect(tx.em.findOneOrFail).toHaveBeenNthCalledWith(2, DossierReviewRunEntity, {
            where: { workspaceId: WS, status: "queued", dossierId: "d2" },
        })
        expect(queue.enqueueDossierReview).not.toHaveBeenCalled()
    })

    it("matches the title's dossier only within the topic given, and a queued workspace run covers it", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                find: [DossierFindingEntity, []],
                findOne: [DossierReviewRunEntity, runOf({ scope: "workspace", dossierId: null })],
            }),
        )
        const { service, inputs, queue } = await build(tx.em)
        inputs.all.mockResolvedValue([dossierOf(), dossierOf({ id: "d4", category: "MEMBERS", ref: "1" })])

        await service.requestForGoneSource(WS, "s1", "MEMBERS", "01. Certificate")

        expect(tx.em.findOne).toHaveBeenCalledTimes(1)
        expect(queue.enqueueDossierReview).not.toHaveBeenCalled()
    })
})

describe("DossierReviewRunsService request", () => {
    it("refuses a workspace without dossiers and an unknown dossier", async () => {
        const { service, inputs, members } = await build(mockEntityManager())
        inputs.all.mockResolvedValue([])

        await expect(service.request("u1", WS, null)).rejects.toMatchObject({
            code: DossierReviewErrorCode.NothingToReview,
        })
        inputs.all.mockResolvedValue([dossierOf()])
        await expect(service.request("u1", WS, "missing")).rejects.toMatchObject({
            code: DossierReviewErrorCode.NothingToReview,
        })
        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
    })

    it("queues a workspace run for an owner or manager and answers it", async () => {
        const { tx, inserts } = freshRun(runOf({ scope: "workspace", dossierId: null, trigger: "request" }))
        const { service, inputs, queue } = await build(tx.em)
        inputs.all.mockResolvedValue([dossierOf()])

        await expect(service.request("u1", WS, null)).resolves.toEqual({
            id: FIRST_ID,
            scope: "workspace",
            dossierId: null,
            trigger: "request",
            status: "queued",
            aiState: null,
            opened: 0,
            resolved: 0,
            dropped: 0,
            startedAt: null,
            finishedAt: null,
            createdAt: AT.toISOString(),
        })
        expect(inserts[0]?.callsOf("values")).toEqual([
            [expect.objectContaining({ scope: "workspace", dossierId: null, requestedBy: "m1", triggerRef: null })],
        ])
        expect(tx.em.findOneOrFail).toHaveBeenCalledWith(DossierReviewRunEntity, {
            where: { workspaceId: WS, status: "queued", dossierId: IsNull() },
        })
        expect(queue.enqueueDossierReview).toHaveBeenCalledTimes(1)
    })

    it("answers the run already queued and enqueues nothing when its insert was ignored", async () => {
        const queued = runOf({ id: "queued", scope: "workspace", dossierId: null, trigger: "request" })
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [DossierReviewRunEntity, queued],
                findOneOrFail: [DossierReviewRunEntity, queued],
            }),
        )
        queueQueryBuilders(tx.em, [{ execute: {} }])
        const { service, inputs, queue } = await build(tx.em)
        inputs.all.mockResolvedValue([dossierOf()])

        await expect(service.request("u1", WS, null)).resolves.toMatchObject({ id: "queued" })
        expect(queue.enqueueDossierReview).not.toHaveBeenCalled()
    })

    it("answers the queued workspace run for a dossier request", async () => {
        const queued = runOf({ id: "whole", scope: "workspace", dossierId: null })
        const tx = fakeTransaction(mockEntityManager({ findOne: [DossierReviewRunEntity, queued] }))
        const { service, inputs } = await build(tx.em)
        inputs.all.mockResolvedValue([dossierOf()])

        await expect(service.request("u1", WS, "d1")).resolves.toMatchObject({ id: "whole", scope: "workspace" })
    })
})
