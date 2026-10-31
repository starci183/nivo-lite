import { Test } from "@nestjs/testing"
import {
    DRAFT_ID,
    dossierEntryOf,
    dossierSourceOf,
    draftRowOf,
    findingRowOf,
    SERVICES_NOW,
    SERVICES_WORKSPACE,
} from "@tests/fixtures/builders/dossier-review-services.builder"
import { factOf } from "@tests/fixtures/builders/brain-facts.builder"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, MoreThanOrEqual } from "typeorm"
import type { DossierEntry } from "@modules/domain/brain-dossiers"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { DossierSourcesService, KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { DossierRemedyDraftsService } from "./dossier-remedy-drafts.service"
import { REMEDY_WRITER } from "./dossier-review.decorators"
import type { RemedyText, RemedyWriter } from "./dossier-review.port"
import { DossierReviewErrorCode } from "./errors/dossier-review.error"
import { DossierFindingEntity, DossierRemedyDraftEntity } from "./persistence/entities"
import { DOSSIER_PACK_WORDS } from "./messages/dossier-pack.messages"
import { ReviewInputsService } from "./review-inputs.service"

const WS = SERVICES_WORKSPACE
const AT = SERVICES_NOW
const PAYLOAD = { draftId: DRAFT_ID, workspaceId: WS }
const CHARTER_REMEDY = DOSSIER_PACK_WORDS.remedies["2"]
const findingOf = (changes: Parameters<typeof findingRowOf>[0] = {}) =>
    findingRowOf({
        id: "f1",
        dossierId: "d2",
        kind: "outdated",
        title: "Charter not updated",
        detail: "Detail",
        remedyAction: "draft",
        remedyDocumentType: "Stored type",
        ...changes,
    })
const draftOf = (changes: Parameters<typeof draftRowOf>[0] = {}) => draftRowOf({ findingId: "f1", ...changes })
const dossierOf = (changes: Parameters<typeof dossierEntryOf>[0] = {}) =>
    dossierEntryOf({ id: "d2", ref: "2", position: 2, name: "Dieu le cong ty", status: "partial", ...changes })

const TEXT: RemedyText = {
    title: "Nghi quyet",
    documentType: "Resolution",
    body: "# Body",
    placeholders: [{ label: "Date", reason: "Unknown" }],
    model: "model-1",
}

const DOSSIERS = [dossierOf(), dossierOf({ id: "d4", ref: "4", name: "Chu ky so" })]

const build = async (em: MockEntityManager, dossiers: ReadonlyArray<DossierEntry> = DOSSIERS) => {
    const writer = mock<RemedyWriter>({ draft: jest.fn().mockResolvedValue(TEXT) })
    const members = mock<WorkspaceMembersService>({ idOf: jest.fn().mockResolvedValue("m1") })
    const inputs = mock<ReviewInputsService>({ all: jest.fn().mockResolvedValue(dossiers) })
    const facts = mock<BrainFactsReadService>({ list: jest.fn().mockResolvedValue([]) })
    const usage = mock<UsageMeterService>({ blockedBy: jest.fn().mockResolvedValue(false) })
    const sources = mock<KnowledgeSourcesService>({ addSource: jest.fn().mockResolvedValue({ id: "new-source" }) })
    const dossierSources = mock<DossierSourcesService>({ byTag: jest.fn().mockResolvedValue(null) })
    const queue = mock<KnowledgeQueue>()
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Record<string, string>) => `${key} ${params.date} ${params.title}`),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DossierRemedyDraftsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: REMEDY_WRITER, useValue: writer },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ReviewInputsService, useValue: inputs },
            { provide: BrainFactsReadService, useValue: facts },
            { provide: UsageMeterService, useValue: usage },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: DossierSourcesService, useValue: dossierSources },
            { provide: KnowledgeQueue, useValue: queue },
        ],
    }).compile()
    return {
        service: moduleRef.get(DossierRemedyDraftsService),
        writer,
        members,
        facts,
        usage,
        sources,
        dossierSources,
        queue,
        catalog,
    }
}

/** A request reading `finding` and its live draft, with `count` drafts asked for today. */
const requesting = (finding: DossierFindingEntity | null, live: DossierRemedyDraftEntity | null = null, count = 0) =>
    fakeTransaction(
        mockEntityManager({
            findOne: [
                [DossierFindingEntity, finding],
                [DossierRemedyDraftEntity, live],
            ],
            count: [DossierRemedyDraftEntity, count],
            save: [DossierRemedyDraftEntity, draftOf()],
        }),
    )

describe("DossierRemedyDraftsService request", () => {
    it("writes a generating draft and its job in one transaction", async () => {
        const tx = requesting(findingOf(), null, 29)
        const { service, queue, members } = await build(tx.em)

        await expect(service.request("u1", WS, "f1", "  Keep it short  ")).resolves.toMatchObject({
            id: DRAFT_ID,
            status: "generating",
        })
        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(tx.em.count).toHaveBeenCalledWith(DossierRemedyDraftEntity, {
            where: { workspaceId: WS, createdAt: MoreThanOrEqual(new Date("2026-10-30T10:00:00.000Z")) },
        })
        expect(tx.em.save).toHaveBeenCalledWith(
            DossierRemedyDraftEntity,
            expect.objectContaining({
                workspaceId: WS,
                findingId: "f1",
                dossierId: "d2",
                status: "generating",
                instructions: "Keep it short",
                requestedBy: "m1",
            }),
        )
        expect(queue.enqueueDossierRemedy).toHaveBeenCalledWith(PAYLOAD, expect.anything())
        expect(tx.commits).toBe(1)
    })

    it("stores no instructions when none were given", async () => {
        const tx = requesting(findingOf({ status: "confirmed" }))
        const { service } = await build(tx.em)

        await service.request("u1", WS, "f1", "   ")
        await service.request("u1", WS, "f1", null)

        const stored = tx.em.save.mock.calls.map((call) => JSON.stringify(call[1]))
        expect(stored.filter((values) => values.includes('"instructions":null'))).toHaveLength(2)
    })
})

describe("DossierRemedyDraftsService request refusals", () => {
    it("answers the live draft of the finding as it is", async () => {
        const { em } = requesting(findingOf(), draftOf({ status: "proposed" }))
        const { service } = await build(em)

        await expect(service.request("u1", WS, "f1", null)).resolves.toMatchObject({ status: "proposed" })
        expect(em.findOne).toHaveBeenLastCalledWith(DossierRemedyDraftEntity, {
            where: { workspaceId: WS, findingId: "f1", status: In(["generating", "proposed"]) },
        })
    })

    it("refuses a missing finding, one NIVO cannot draft, a closed one and the daily limit", async () => {
        const expectCode = async (em: MockEntityManager, code: DossierReviewErrorCode) => {
            const { service } = await build(em)
            await expect(service.request("u1", WS, "f1", null)).rejects.toMatchObject({ code })
        }
        await expectCode(requesting(null).em, DossierReviewErrorCode.FindingNotFound)
        await expectCode(requesting(findingOf({ remedyAction: "upload" })).em, DossierReviewErrorCode.TransitionRefused)
        await expectCode(requesting(findingOf({ status: "dismissed" })).em, DossierReviewErrorCode.TransitionRefused)
        await expectCode(requesting(findingOf(), null, 30).em, DossierReviewErrorCode.DraftDailyLimit)
    })
})

/** A job reading `draft` and `finding`, whose writes land. */
const generating = (draft: DossierRemedyDraftEntity | null, finding: DossierFindingEntity | null = findingOf()) => ({
    em: mockEntityManager({
        findOne: [
            [DossierRemedyDraftEntity, draft],
            [DossierFindingEntity, finding],
        ],
        update: [DossierRemedyDraftEntity, { affected: 1 }],
    }),
})

describe("DossierRemedyDraftsService generate", () => {
    it("skips a payload of another shape, a draft that is gone or no longer generating", async () => {
        const { service } = await build(generating(null).em)
        await expect(service.generate({ runId: "x" })).resolves.toBe("skipped")
        await expect(service.generate(PAYLOAD)).resolves.toBe("skipped")
        const { service: settled } = await build(generating(draftOf({ status: "proposed" })).em)
        await expect(settled.generate(PAYLOAD)).resolves.toBe("skipped")
    })

    it("fails the draft when its finding is gone, the credits ran out, or the model cannot answer", async () => {
        const { em: gone } = generating(draftOf(), null)
        const { service } = await build(gone)
        await expect(service.generate(PAYLOAD)).resolves.toBe("done")
        expect(gone.update).toHaveBeenCalledWith(
            DossierRemedyDraftEntity,
            { id: DRAFT_ID, workspaceId: WS, status: "generating" },
            { status: "failed", error: "DOSSIER_REVIEW_FINDING_NOT_FOUND" },
        )

        const { em: blocked } = generating(draftOf())
        const credits = await build(blocked)
        credits.usage.blockedBy.mockResolvedValue(true)
        await credits.service.generate(PAYLOAD)
        expect(credits.usage.blockedBy).toHaveBeenCalledWith(WS, "brain", false)
        expect(blocked.update).toHaveBeenCalledWith(DossierRemedyDraftEntity, expect.anything(), {
            status: "failed",
            error: "blocked_credits",
        })
        expect(credits.writer.draft).not.toHaveBeenCalled()

        const { em: silent } = generating(draftOf())
        const model = await build(silent)
        model.writer.draft.mockResolvedValue(null)
        await model.service.generate(PAYLOAD)
        expect(silent.update).toHaveBeenCalledWith(DossierRemedyDraftEntity, expect.anything(), {
            status: "failed",
            error: "DOSSIER_REVIEW_MODEL_UNAVAILABLE",
        })
    })
})

describe("DossierRemedyDraftsService generate writes", () => {
    it("writes the draft from the finding, the pack's remedy and the identity facts, with the fixed tail", async () => {
        const { em } = generating(draftOf())
        const { service, writer, facts, catalog } = await build(em)
        const taxCode = {
            attribute: "ma-so-thue",
            subjectLabel: "Cong ty TNHH Mau",
            attributeLabel: "MST",
            value: "0100000001",
        }
        facts.list.mockResolvedValue([factOf(taxCode), factOf({ attribute: "hours" })])
        writer.draft.mockResolvedValue({
            ...TEXT,
            title: "T".repeat(170),
            placeholders: Array.from({ length: 31 }, (_, index) => ({ label: `L${index}`, reason: "R" })),
        })

        await expect(service.generate(PAYLOAD)).resolves.toBe("done")

        expect(facts.list).toHaveBeenCalledWith(WS, { statuses: ["active", "proposed"], limit: 500 })
        expect(writer.draft).toHaveBeenCalledWith({
            workspaceId: WS,
            today: "2026-10-31",
            finding: {
                kind: "outdated",
                severity: "high",
                title: "Charter not updated",
                detail: "Detail",
                evidence: [{ label: "Transfer", quote: "17/08/2026" }],
            },
            dossier: { ref: "2", name: "Dieu le cong ty", category: "LEGAL FILES" },
            remedy: { documentType: CHARTER_REMEDY.documentType, guidance: CHARTER_REMEDY.guidance },
            identity: ["Cong ty TNHH Mau - MST: 0100000001"],
            instructions: "Keep it short",
        })
        const tail = { date: "31/10/2026", title: "Charter not updated" }
        expect(catalog.get).toHaveBeenCalledWith("draft.tail", tail, "vi")
        expect(em.update).toHaveBeenCalledWith(
            DossierRemedyDraftEntity,
            { id: DRAFT_ID, workspaceId: WS, status: "generating" },
            expect.objectContaining({
                status: "proposed",
                title: "T".repeat(160),
                documentType: "Resolution",
                body: "# Body\n\ndraft.tail 31/10/2026 Charter not updated",
                model: "model-1",
                error: null,
            }),
        )
        const written = JSON.stringify(em.update.mock.calls[0]?.[2])
        expect(written).toContain('{"label":"L0","reason":"R"}')
        expect(written.match(/"label"/gu)).toHaveLength(30)
    })

    it("falls back to the finding's own document type when the pack has no remedy or no dossier", async () => {
        const noRemedy = await build(generating(draftOf(), findingOf({ dossierId: "d4" })).em)
        await noRemedy.service.generate(PAYLOAD)
        expect(noRemedy.writer.draft).toHaveBeenCalledWith(
            expect.objectContaining({
                dossier: { ref: "4", name: "Chu ky so", category: "LEGAL FILES" },
                remedy: { documentType: "Stored type", guidance: null },
            }),
        )

        const noDossier = await build(generating(draftOf(), findingOf({ dossierId: "gone" })).em)
        await noDossier.service.generate(PAYLOAD)
        expect(noDossier.writer.draft).toHaveBeenCalledWith(
            expect.objectContaining({
                dossier: { ref: "", name: "", category: "" },
                remedy: { documentType: "Stored type", guidance: null },
            }),
        )
    })
})

describe("DossierRemedyDraftsService fail and get", () => {
    it("ends a generating draft failed, and ignores a payload of another shape", async () => {
        const em = mockEntityManager({ update: [DossierRemedyDraftEntity, { affected: 1 }] })
        const { service } = await build(em)

        await service.fail({ nothing: true })
        await service.fail(PAYLOAD)

        expect(em.update).toHaveBeenCalledTimes(1)
        expect(em.update).toHaveBeenCalledWith(
            DossierRemedyDraftEntity,
            { id: DRAFT_ID, workspaceId: WS, status: "generating" },
            { status: "failed", error: "job_failed" },
        )
    })

    it("answers a draft to any member, or null", async () => {
        const em = mockEntityManager({
            findOne: [
                [DossierRemedyDraftEntity, draftOf()],
                [DossierRemedyDraftEntity, null],
            ],
        })
        const { service, members } = await build(em)

        await expect(service.get("u1", WS, DRAFT_ID)).resolves.toMatchObject({
            id: DRAFT_ID,
            instructions: "Keep it short",
        })
        await expect(service.get("u1", WS, DRAFT_ID)).resolves.toBeNull()
        expect(members.require).toHaveBeenCalledWith("u1", WS)
    })
})

describe("DossierRemedyDraftsService save and reject", () => {
    it("saves the edits of a proposed draft and rejects it with or without a reason", async () => {
        const em = mockEntityManager({
            findOne: [DossierRemedyDraftEntity, draftOf({ status: "proposed" })],
            update: [DossierRemedyDraftEntity, { affected: 1 }],
        })
        const { service } = await build(em)

        await service.save("u1", WS, DRAFT_ID, "  New title  ", "New body")
        await service.reject("u1", WS, DRAFT_ID, " Wrong type ")
        await service.reject("u1", WS, DRAFT_ID, null)

        const where = { id: DRAFT_ID, workspaceId: WS, status: "proposed" }
        expect(em.update.mock.calls.map((call): ReadonlyArray<unknown> => [call[1], call[2]])).toEqual([
            [where, { title: "New title", body: "New body" }],
            [where, { status: "rejected", rejectReason: "Wrong type", decidedBy: "m1", decidedAt: AT }],
            [where, { status: "rejected", rejectReason: null, decidedBy: "m1", decidedAt: AT }],
        ])
    })

    it("refuses a draft that is gone, one not proposed, and a change that lost a race", async () => {
        const { service: gone } = await build(mockEntityManager({ findOne: [DossierRemedyDraftEntity, null] }))
        await expect(gone.save("u1", WS, DRAFT_ID, "T", "B")).rejects.toMatchObject({
            code: DossierReviewErrorCode.DraftNotFound,
        })
        const { service: generatingDraft } = await build(
            mockEntityManager({ findOne: [DossierRemedyDraftEntity, draftOf()] }),
        )
        await expect(generatingDraft.reject("u1", WS, DRAFT_ID, null)).rejects.toMatchObject({
            code: DossierReviewErrorCode.TransitionRefused,
        })
        const { service: raced } = await build(
            mockEntityManager({
                findOne: [DossierRemedyDraftEntity, draftOf({ status: "proposed" })],
                update: [DossierRemedyDraftEntity, { affected: 0 }],
            }),
        )
        await expect(raced.save("u1", WS, DRAFT_ID, "T", "B")).rejects.toMatchObject({
            code: DossierReviewErrorCode.TransitionRefused,
        })
    })
})

/** An approval reading the draft in `statuses` order, whose writes land. */
const approving = (draft: DossierRemedyDraftEntity) =>
    fakeTransaction(
        mockEntityManager({
            findOne: [
                [DossierRemedyDraftEntity, draft],
                [DossierRemedyDraftEntity, draft],
                [DossierRemedyDraftEntity, { ...draft, status: "approved" }],
            ],
            update: [
                [DossierRemedyDraftEntity, { affected: 1 }],
                [DossierFindingEntity, { affected: 1 }],
            ],
        }),
    )

describe("DossierRemedyDraftsService approve", () => {
    it("answers an approved draft as it is", async () => {
        const em = mockEntityManager({ findOne: [DossierRemedyDraftEntity, draftOf({ status: "approved" })] })
        const { service, sources } = await build(em)

        await expect(service.approve("u1", WS, DRAFT_ID)).resolves.toMatchObject({ status: "approved" })
        expect(sources.addSource).not.toHaveBeenCalled()
    })

    it("files the draft into its dossier as the approving user and resolves its finding", async () => {
        const tx = approving(draftOf({ status: "proposed", title: "Nghi quyet", body: "Body" }))
        const { service, sources, dossierSources } = await build(tx.em)

        await expect(service.approve("u1", WS, DRAFT_ID)).resolves.toMatchObject({ status: "approved" })

        expect(dossierSources.byTag).toHaveBeenCalledWith(WS, "remedy:bbbbbbbb000040008000000000000001")
        expect(sources.addSource).toHaveBeenCalledWith("u1", WS, {
            kind: "text",
            title: "02. Nghi quyet",
            content: "Body",
            topic: "LEGAL FILES",
            tags: ["dossier:2", "nivo:draft", "remedy:bbbbbbbb000040008000000000000001"],
            visibility: "internal",
            origin: "dossier-review",
        })
        expect(tx.em.update).toHaveBeenCalledWith(
            DossierRemedyDraftEntity,
            { id: DRAFT_ID, workspaceId: WS, status: "proposed" },
            { status: "approved", sourceId: "new-source", decidedBy: "m1", decidedAt: AT },
        )
        expect(tx.em.update).toHaveBeenCalledWith(
            DossierFindingEntity,
            { id: "f1", workspaceId: WS, status: In(["open", "confirmed"]) },
            { status: "resolved", resolution: "draft", resolvedAt: AT, decidedBy: "m1", decidedAt: AT },
        )
        expect(tx.commits).toBe(1)
    })
})

describe("DossierRemedyDraftsService approve retries", () => {
    it("reuses the source a retry already added, and files a draft without a dossier untitled by reference", async () => {
        const reused = approving(draftOf({ status: "proposed" }))
        const retry = await build(reused.em)
        retry.dossierSources.byTag.mockResolvedValue(dossierSourceOf({ id: "kept" }))
        await retry.service.approve("u1", WS, DRAFT_ID)
        expect(retry.sources.addSource).not.toHaveBeenCalled()
        expect(reused.em.update).toHaveBeenCalledWith(
            DossierRemedyDraftEntity,
            expect.anything(),
            expect.objectContaining({ sourceId: "kept" }),
        )

        const orphan = approving(draftOf({ status: "proposed", dossierId: null, title: "Loose" }))
        const loose = await build(orphan.em)
        await loose.service.approve("u1", WS, DRAFT_ID)
        expect(loose.sources.addSource).toHaveBeenCalledWith("u1", WS, {
            kind: "text",
            title: "Loose",
            content: "",
            tags: ["nivo:draft", "remedy:bbbbbbbb000040008000000000000001"],
            visibility: "internal",
            origin: "dossier-review",
        })
    })

    it("keeps a reference that is not a single digit as it is", async () => {
        const tx = approving(draftOf({ status: "proposed", dossierId: "dB", title: "Minutes" }))
        const { service, sources } = await build(tx.em, [
            dossierOf({ id: "dB", ref: "BKS", category: "SUPERVISORS", name: "Ho so Ban kiem soat" }),
        ])

        await service.approve("u1", WS, DRAFT_ID)

        expect(sources.addSource).toHaveBeenCalledWith(
            "u1",
            WS,
            expect.objectContaining({
                title: "BKS. Minutes",
                topic: "SUPERVISORS",
                tags: ["dossier:BKS", "nivo:draft", "remedy:bbbbbbbb000040008000000000000001"],
            }),
        )
    })
})
