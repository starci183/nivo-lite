import {
    publicArchiveTransaction,
    publicPublishedChangeOf,
    publicPublishedDocumentOf,
    publicReviewRequestOf,
    publicPublicationOf,
    publicChangedReviewOf,
    publicReplayDocumentOf,
    publicMissingReviewAnswers,
    publicMutationAnswers,
    PUBLIC_DRAFT_REFUSALS,
    PUBLIC_REDRAFT_REFUSALS,
    publicDocumentListAnswers,
    editablePublicDocumentAnswers,
    publicSourceState as stateOf,
    publicApprovalTransaction as approving,
    draftRequestTransaction,
    WS,
    documentRow as rowOf,
    documentSourceRow as sourceRowOf,
    writtenDocumentAnswers,
    PUBLIC_WRITE_REFUSALS,
    publicApprovalRow,
} from "@tests/fixtures/builders/public-documents.builder"
import { Test } from "@nestjs/testing"
import { Not } from "typeorm"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesReadService, PublishedSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { KnowledgeQueue } from "@modules/queues/knowledge"
import { KNOWLEDGE_QUEUE_PRODUCER } from "@modules/queues/knowledge"

import { PublicDocumentsErrorCode } from "./errors/public-documents.error"
import { PublicDocumentEntity, PublicDocumentSourceEntity, PublicDocumentApprovalEntity } from "./persistence/entities"
import { PublicDocumentsService } from "./public-documents.service"

const AT = "2026-11-01T10:00:00.000Z"
const codes = PublicDocumentsErrorCode
const MANAGERS = ["owner", "manager"]

const build = async (em: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(mock<WorkspaceMember>({ displayName: "Owner" }))
    const sources = mock<KnowledgeSourcesReadService>()
    sources.statesOf.mockResolvedValue([stateOf()])
    const published = mock<PublishedSourcesService>()
    const queue = mock<KnowledgeQueue>()
    const gaps = mock<KnowledgeGapsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicDocumentsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: KnowledgeSourcesReadService, useValue: sources },
            { provide: PublishedSourcesService, useValue: published },
            { provide: KNOWLEDGE_QUEUE_PRODUCER, useValue: queue },
            { provide: KnowledgeGapsService, useValue: gaps },
        ],
    }).compile()
    return { service: moduleRef.get(PublicDocumentsService), members, sources, published, queue, gaps }
}

describe("PublicDocumentsService list", () => {
    it("lists the documents that are not archived, latest first, with their sources and what changed", async () => {
        const em = mockEntityManager(publicDocumentListAnswers(publicPublishedDocumentOf()))
        const { service, members, sources } = await build(em)
        sources.statesOf.mockResolvedValue([stateOf({ contentHash: "h2" })])

        const [view] = await service.list("u1", WS)

        expect(members.require).toHaveBeenCalledWith("u1", WS, MANAGERS)
        expect(em.find).toHaveBeenCalledWith(PublicDocumentEntity, {
            where: { workspaceId: WS, status: Not("archived") },
            order: { updatedAt: "DESC" },
            take: 200,
        })
        expect(view).toMatchObject({
            id: "d1",
            needsReview: true,
            sources: [{ sourceId: "s1", title: "Delivery policy", changed: true }],
        })
    })

    it("reads nothing more when there is no document", async () => {
        const em = mockEntityManager({ find: [PublicDocumentEntity, []] })
        const { service, sources } = await build(em)

        await expect(service.list("u1", WS)).resolves.toEqual([])
        expect(sources.statesOf).not.toHaveBeenCalled()
    })
})

describe("PublicDocumentsService countProposals", () => {
    it("counts the answers NIVO proposed that wait for approval", async () => {
        const em = mockEntityManager({ count: [PublicDocumentEntity, 3] })
        const { service } = await build(em)

        await expect(service.countProposals(WS)).resolves.toBe(3)

        expect(em.count).toHaveBeenCalledWith(PublicDocumentEntity, {
            where: { workspaceId: WS, kind: "answer", status: "draft" },
        })
    })
})

describe("PublicDocumentsService write", () => {
    it("keeps a hand-written text as a draft of the owner", async () => {
        const em = mockEntityManager(writtenDocumentAnswers())
        const { service } = await build(em)

        await expect(
            service.write("u1", WS, { title: " Opening hours ", body: " Open 8 to 21 " }),
        ).resolves.toMatchObject({
            id: "d1",
            kind: "written",
        })
        expect(em.insert).toHaveBeenCalledWith(PublicDocumentEntity, {
            workspaceId: WS,
            title: "Opening hours",
            body: "Open 8 to 21",
            kind: "written",
            status: "draft",
            createdBy: "u1",
        })
    })

    it.each(PUBLIC_WRITE_REFUSALS)("refuses %s", async (_name, request, code) => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.write("u1", WS, request)).rejects.toMatchObject({ code })
        expect(em.insert).not.toHaveBeenCalled()
    })

    it("fails when the insert answers no row", async () => {
        const em = mockEntityManager({ insert: [PublicDocumentEntity, { identifiers: [] }] })
        const { service } = await build(em)

        await expect(service.write("u1", WS, { title: "T", body: "b" })).rejects.toMatchObject({ code: codes.NotFound })
    })
})

describe("PublicDocumentsService requestDraft", () => {
    const request = { title: "Frequent questions", sourceIds: ["s1", "s1"], instructions: " Keep it short " }

    it("writes the row as drafting with its sources and queues the job in one transaction", async () => {
        const tx = draftRequestTransaction()
        const { service, queue, sources } = await build(tx.em)

        await expect(service.requestDraft("u1", WS, request)).resolves.toMatchObject({ id: "d1", status: "drafting" })

        expect(sources.statesOf).toHaveBeenCalledWith(WS, ["s1"])
        expect(tx.em.insert).toHaveBeenCalledWith(PublicDocumentEntity, {
            workspaceId: WS,
            title: "Frequent questions",
            kind: "drafted",
            status: "drafting",
            instructions: "Keep it short",
            createdBy: "u1",
        })
        expect(tx.em.insert).toHaveBeenCalledWith(PublicDocumentSourceEntity, [
            { documentId: "d1", sourceId: "s1", workspaceId: WS, sourceTitle: "Delivery policy", contentHash: "h1" },
        ])
        expect(queue.enqueuePublicDraft).toHaveBeenCalledWith(
            { documentId: "d1", workspaceId: WS, draftRevision: 0 },
            expect.anything(),
        )
        expect(tx.commits).toBe(1)
    })

    it("stores no note when the owner gave none", async () => {
        const tx = draftRequestTransaction([])
        const { service } = await build(tx.em)

        await service.requestDraft("u1", WS, { title: "T", sourceIds: ["s1"] })

        expect(tx.em.insert).toHaveBeenCalledWith(PublicDocumentEntity, expect.objectContaining({ instructions: null }))
    })

    it.each(PUBLIC_DRAFT_REFUSALS)("refuses %s", async (_name, asked, states, code) => {
        const em = mockEntityManager()
        const { service, sources, queue } = await build(em)
        sources.statesOf.mockResolvedValue(states)

        await expect(service.requestDraft("u1", WS, asked)).rejects.toMatchObject({ code })
        expect(queue.enqueuePublicDraft).not.toHaveBeenCalled()
    })
})

describe("PublicDocumentsService redraft", () => {
    it("puts the document back to drafting and queues the job under a key of its own", async () => {
        const tx = fakeTransaction(mockEntityManager(publicMutationAnswers(publicPublishedDocumentOf())))
        const { service, queue } = await build(tx.em)

        await service.redraft("u1", WS, "d1")

        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS, status: "published", draftRevision: 0 },
            { status: "drafting", failureCode: null, draftRevision: 1 },
        )
        expect(queue.enqueuePublicDraft).toHaveBeenCalledWith(
            { documentId: "d1", workspaceId: WS, draftRevision: 1 },
            expect.anything(),
        )
    })

    it.each(PUBLIC_REDRAFT_REFUSALS)("refuses %s", async (_name, row, sources) => {
        const em = mockEntityManager({
            findOne: [PublicDocumentEntity, row],
            find: [PublicDocumentSourceEntity, sources],
        })
        const { service, queue } = await build(em)

        await expect(service.redraft("u1", WS, "d1")).rejects.toMatchObject({ code: codes.NotEditable })
        expect(queue.enqueuePublicDraft).not.toHaveBeenCalled()
    })

    it("refuses a document the workspace does not have", async () => {
        const em = mockEntityManager({ findOne: [PublicDocumentEntity, null] })
        const { service } = await build(em)

        await expect(service.redraft("u1", WS, "d9")).rejects.toMatchObject({ code: codes.NotFound })
    })
})

describe("PublicDocumentsService update", () => {
    it("changes the title and the text; a failed draft the owner rewrites becomes a draft", async () => {
        const em = mockEntityManager(editablePublicDocumentAnswers(rowOf({ status: "failed", failureCode: "X" })))
        const { service } = await build(em)

        await service.update("u1", WS, { id: "d1", title: " New ", body: " Content " })

        expect(em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS, status: "failed", draftRevision: 0 },
            { title: "New", body: "Content", status: "draft", failureCode: null, draftRevision: 1 },
        )
    })

    it.each([{ body: "New" }, { title: "New" }])(
        "keeps what is not named and a published document published, serving its approved text: %j",
        async (patch) => {
            const em = mockEntityManager(editablePublicDocumentAnswers(publicPublishedDocumentOf()))
            const { service } = await build(em)

            await service.update("u1", WS, { id: "d1", ...patch })

            expect(em.update).toHaveBeenCalledWith(
                PublicDocumentEntity,
                { id: "d1", workspaceId: WS, status: "published", draftRevision: 0 },
                { ...patch, status: "published", failureCode: null, draftRevision: 1 },
            )
        },
    )

    it.each(["drafting", "archived"] as const)("refuses a %s document", async (status) => {
        const em = mockEntityManager({
            findOne: [PublicDocumentEntity, rowOf({ status })],
            find: [PublicDocumentSourceEntity, [sourceRowOf()]],
        })
        const { service } = await build(em)

        await expect(service.update("u1", WS, { id: "d1", body: "x" })).rejects.toMatchObject({
            code: codes.NotEditable,
        })
    })
})

describe("PublicDocumentsService approve", () => {
    it("publishes the text as its own public source, with the document id, and records the approver, the time and the sources", async () => {
        const tx = approving(rowOf())
        const { service, published, sources } = await build(tx.em)
        sources.statesOf.mockResolvedValueOnce([stateOf()]).mockResolvedValueOnce([]).mockResolvedValue([stateOf()])

        await service.approve("u1", WS, publicReviewRequestOf())

        expect(published.publish).toHaveBeenCalledWith(WS, "u1", "d1", publicPublicationOf(), expect.anything())
        expect(published.replace).not.toHaveBeenCalled()
        expect(tx.em.insert).toHaveBeenCalledWith(PublicDocumentApprovalEntity, publicApprovalRow())
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS },
            publicPublishedChangeOf(),
        )
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentSourceEntity,
            { documentId: "d1", sourceId: "s1" },
            { sourceTitle: "Delivery policy", contentHash: "h1" },
        )
    })

    it("replaces the text of the public source it already has", async () => {
        const tx = approving(rowOf({ status: "published", publishedBody: "old" }))
        const { service, published } = await build(tx.em)

        await service.approve("u1", WS, publicReviewRequestOf())

        expect(published.replace).toHaveBeenCalledWith(WS, "d1", publicPublicationOf(), expect.anything())
        expect(published.publish).not.toHaveBeenCalled()
    })
})

describe("PublicDocumentsService approve", () => {
    it("records a new source review of the same published text, only after explicit acknowledgement", async () => {
        const tx = approving(rowOf({ status: "published", publishedBody: "Same day delivery.", publishedRevision: 0 }))
        const { service, sources, published } = await build(tx.em)
        sources.statesOf.mockResolvedValue([stateOf({ contentHash: "h2" })])

        await expect(service.approve("u1", WS, publicReviewRequestOf())).rejects.toMatchObject({
            code: codes.SourcesChanged,
        })
        expect(published.replace).not.toHaveBeenCalled()

        await service.approve("u1", WS, { id: "d1", expectedDraftRevision: 0, reviewedChanges: true })

        expect(tx.em.insert).toHaveBeenCalledWith(PublicDocumentApprovalEntity, publicChangedReviewOf())
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS },
            expect.objectContaining({ draftRevision: 1, publishedRevision: 1 }),
        )
        expect(published.publish).not.toHaveBeenCalled()
        expect(published.replace).not.toHaveBeenCalled()
        expect(published.announce).not.toHaveBeenCalled()

        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentSourceEntity,
            { documentId: "d1", sourceId: "s1" },
            { sourceTitle: "Delivery policy", contentHash: "h2" },
        )
    })
})

describe("PublicDocumentsService approve a proposal and refusals", () => {
    it("marks the customer question it answers as answered by this document", async () => {
        const tx = approving(rowOf({ kind: "answer", gapId: "g1", question: "Delivery tonight?" }))
        const { service, gaps } = await build(tx.em)

        await service.approve("u1", WS, publicReviewRequestOf())

        expect(gaps.answer).toHaveBeenCalledWith(WS, "g1", "document:d1")
    })

    it("does not touch a question when the document answers none", async () => {
        const tx = approving(rowOf())
        const { service, gaps } = await build(tx.em)

        await service.approve("u1", WS, publicReviewRequestOf())

        expect(gaps.answer).not.toHaveBeenCalled()
    })

    it.each([
        ["an empty text", rowOf({ body: "  " }), codes.BodyRequired],
        ["a document being drafted", rowOf({ status: "drafting" }), codes.NotEditable],
        ["a failed document", rowOf({ status: "failed" }), codes.NotEditable],
    ])("refuses %s", async (_name, row, code) => {
        const tx = approving(row)
        const { service, published } = await build(tx.em)

        await expect(service.approve("u1", WS, publicReviewRequestOf())).rejects.toMatchObject({ code })
        expect(published.publish).not.toHaveBeenCalled()
    })
})

describe("PublicDocumentsService archive", () => {
    it("takes the public source down and archives the document", async () => {
        const tx = publicArchiveTransaction(publicPublishedDocumentOf())
        const { service, published, members } = await build(tx.em)

        await service.archive("u1", WS, "d1")

        expect(members.require).toHaveBeenCalledWith("u1", WS, MANAGERS)
        expect(published.withdraw).toHaveBeenCalledWith(WS, "d1", expect.anything())
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS },
            { status: "archived", publishedSourceId: null },
        )
    })

    it("refuses a document the workspace does not have", async () => {
        const tx = fakeTransaction(mockEntityManager({ findOne: [PublicDocumentEntity, null] }))
        const { service, published } = await build(tx.em)

        await expect(service.archive("u1", WS, "d9")).rejects.toMatchObject({ code: codes.NotFound })
        expect(published.withdraw).not.toHaveBeenCalled()
    })
})

describe("PublicDocumentsService roles", () => {
    it("lets only an owner or a manager in", async () => {
        const em = mockEntityManager()
        const { service, members } = await build(em)
        members.require.mockRejectedValue(new Error("forbidden"))

        await expect(service.list("u1", WS)).rejects.toThrow("forbidden")
        await expect(service.approve("u1", WS, publicReviewRequestOf())).rejects.toThrow("forbidden")
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("PublicDocumentsService publication rollback", () => {
    it("rolls back publication when the approval record cannot be written and sends no post-commit announcement", async () => {
        const tx = approving(rowOf())
        const { service, published, sources } = await build(tx.em)
        sources.statesOf.mockResolvedValueOnce([stateOf()]).mockResolvedValueOnce([])
        tx.em.update.mockRejectedValueOnce(new Error("approval store unavailable"))

        await expect(service.approve("u1", WS, publicReviewRequestOf())).rejects.toThrow("approval store unavailable")

        expect(tx.rollbacks).toBe(1)
        expect(tx.commits).toBe(0)
        expect(published.publish).toHaveBeenCalledWith(WS, "u1", "d1", expect.anything(), expect.anything())
        expect(published.announce).not.toHaveBeenCalled()
        expect(tx.em.findOne).toHaveBeenCalledWith(PublicDocumentEntity, {
            where: { id: "d1", workspaceId: WS },
            lock: { mode: "pessimistic_write" },
        })
    })
})

describe("PublicDocumentsService reviewed revision", () => {
    it("refuses text changed since the approver read it before recording or publishing anything", async () => {
        const tx = approving(rowOf({ body: "Unreviewed replacement", draftRevision: 1 }))
        const { service, published } = await build(tx.em)

        await expect(service.approve("u1", WS, publicReviewRequestOf())).rejects.toMatchObject({
            code: codes.StaleReview,
        })

        expect(tx.em.insert).not.toHaveBeenCalled()
        expect(published.publish).not.toHaveBeenCalled()
        expect(published.replace).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })

    it("replays an already-approved exact revision without rewriting the immutable actor or republishing", async () => {
        const tx = approving(publicReplayDocumentOf())
        const { service, published } = await build(tx.em)

        await service.approve("u1", WS, publicReviewRequestOf())

        expect(tx.em.insert).not.toHaveBeenCalled()
        expect(tx.em.update).not.toHaveBeenCalled()
        expect(published.publish).not.toHaveBeenCalled()
        expect(published.replace).not.toHaveBeenCalled()
        expect(published.announce).not.toHaveBeenCalled()
    })
})

describe("PublicDocumentsService concurrent revisions", () => {
    it.each([0, undefined])("refuses redraft and update when the revision write affects %s rows", async (affected) => {
        const em = mockEntityManager(publicMutationAnswers())
        const tx = fakeTransaction(em)
        em.update.mockResolvedValue({ ...(affected === undefined ? {} : { affected }), raw: [], generatedMaps: [] })
        const { service, queue } = await build(em)
        await expect(service.redraft("u1", WS, "d1")).rejects.toMatchObject({ code: codes.NotEditable })
        await expect(service.update("u1", WS, { id: "d1", body: "New" })).rejects.toMatchObject({
            code: codes.NotEditable,
        })
        expect(queue.enqueuePublicDraft).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})

describe("PublicDocumentsService missing immutable history", () => {
    it("refuses both replay and listing when a published exact revision lost its audit", async () => {
        const em = mockEntityManager(publicMissingReviewAnswers())
        const tx = fakeTransaction(em)
        const { service, published } = await build(em)
        await expect(service.approve("u1", WS, publicReviewRequestOf())).rejects.toMatchObject({
            code: codes.NotFound,
        })
        await expect(service.list("u1", WS)).rejects.toMatchObject({ code: codes.NotFound })
        expect(em.insert).not.toHaveBeenCalled()
        expect(published.publish).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })

    it("records unavailable current hashes as empty working provenance after explicit review", async () => {
        const tx = approving(rowOf())
        const { service, sources } = await build(tx.em)
        sources.statesOf.mockResolvedValue([stateOf({ contentHash: null })])
        await service.approve("u1", WS, { id: "d1", expectedDraftRevision: 0, reviewedChanges: true })
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentSourceEntity,
            { documentId: "d1", sourceId: "s1" },
            { sourceTitle: "Delivery policy", contentHash: "" },
        )
        expect(tx.commits).toBe(1)
    })
})
