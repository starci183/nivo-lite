import { Test } from "@nestjs/testing"
import {
    DRAFT_ID,
    dossierEntryOf,
    draftRowOf,
    FINDING_ID,
    findingRowOf,
    reviewRowOf,
    runRowOf,
    SERVICES_NOW,
    SERVICES_WORKSPACE,
} from "@tests/fixtures/builders/dossier-review-services.builder"
import { FakeClock, mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { MemberLookupService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { DossierFindingsService } from "./dossier-findings.service"
import { DossierReviewErrorCode } from "./errors/dossier-review.error"
import {
    DossierFindingEntity,
    DossierRemedyDraftEntity,
    DossierReviewEntity,
    DossierReviewRunEntity,
} from "./persistence/entities"
import { ReviewInputsService } from "./review-inputs.service"

const WS = SERVICES_WORKSPACE
const F1 = FINDING_ID
const F2 = "aaaaaaaa-0000-4000-8000-000000000002"
const AT = SERVICES_NOW
const findingOf = findingRowOf
const draftOf = (changes: Parameters<typeof draftRowOf>[0] = {}) => draftRowOf({ status: "proposed", ...changes })
const DOSSIER = dossierEntryOf()

/** What a call throws before it returns, or null. */
const thrownBy = (work: () => unknown): unknown => {
    try {
        work()
    } catch (error) {
        return error
    }
    return null
}

const build = async (em: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>({ idOf: jest.fn().mockResolvedValue("m1") })
    const lookup = mock<MemberLookupService>()
    const inputs = mock<ReviewInputsService>({ all: jest.fn().mockResolvedValue([DOSSIER]) })
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, _params: object, locale: string) => `${locale}:${key}`),
    })
    const chunks = mock<KnowledgeChunksService>({ placesOf: jest.fn().mockResolvedValue(new Map()) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DossierFindingsService,
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: MemberLookupService, useValue: lookup },
            { provide: ReviewInputsService, useValue: inputs },
        ],
    }).compile()
    return { service: moduleRef.get(DossierFindingsService), members, lookup, catalog, chunks }
}

describe("DossierFindingsService list", () => {
    it("lists a page with every filter, rule findings in the locale, and continues from its cursor", async () => {
        const em = mockEntityManager({
            find: [
                [DossierRemedyDraftEntity, [draftOf()]],
                [DossierRemedyDraftEntity, [draftOf(), draftOf({ id: "dr0", status: "rejected" })]],
            ],
        })
        const ai = findingOf({ id: F2, origin: "ai", code: null, dossierId: null, severity: "medium" })
        const [first, second] = queueQueryBuilders(em, [{ getMany: [findingOf(), ai] }, { getMany: [ai] }])
        const { service, members } = await build(em)
        const filter = {
            first: 1,
            dossierId: "d1",
            statuses: ["open"],
            severities: ["high", "medium"],
            assigneeId: "m9",
            unassigned: true,
            draftsAwaiting: true,
        }

        const page = await service.list("u1", WS, filter, "en")

        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(page.nodes).toEqual([
            expect.objectContaining({
                id: F1,
                dossierRef: "1",
                dossierName: "Certificate",
                title: "en:findings.presence_expected.title",
                detail: "en:findings.presence_expected.detail",
                draftId: DRAFT_ID,
                draftStatus: "proposed",
                params: [{ name: "dossier", value: "1. Certificate" }],
            }),
        ])
        expect(page.pageInfo.hasNextPage).toBe(true)
        expect(first?.callsOf("andWhere")).toEqual([
            ["f.dossierId = :dossierId", { dossierId: "d1" }],
            ["f.status IN (:...statuses)", { statuses: ["open"] }],
            ["f.severity IN (:...severities)", { severities: ["high", "medium"] }],
            ["f.assigneeId = :assigneeId", { assigneeId: "m9" }],
            ["f.assigneeId IS NULL"],
            ["f.id IN (:...awaiting)", { awaiting: [F1] }],
        ])
        expect(first?.callsOf("limit")).toEqual([[2]])

        const next = await service.list("u1", WS, { ...filter, after: page.pageInfo.endCursor }, "en")

        expect(second?.callsOf("andWhere").at(-1)).toEqual([
            expect.stringContaining("f.lastSeenAt < :at"),
            { rank: 1, at: AT.toISOString(), id: F1 },
        ])
        expect(next.nodes).toEqual([
            expect.objectContaining({ id: F2, dossierRef: null, title: "Stored title", draftId: null }),
        ])
        expect(next.pageInfo.hasNextPage).toBe(false)
    })
})

describe("DossierFindingsService evidence places", () => {
    const quoted = (passageId: string | null) => ({
        role: "claim" as const,
        label: "Price list",
        sourceId: "s1",
        sourceTitle: "Bang gia.pdf",
        passageId,
        factId: null,
        factLine: null,
        quote: "Gia 5.000.000 dong",
    })

    it("names the page of a quoted passage and leaves a passage with no stored place without one", async () => {
        const em = mockEntityManager({ find: [DossierRemedyDraftEntity, []] })
        queueQueryBuilders(em, [{ getMany: [findingOf({ evidence: [quoted("p1"), quoted("p2"), quoted(null)] })] }])
        const { service, chunks } = await build(em)
        chunks.placesOf.mockResolvedValue(new Map([["p1", { kind: "page", label: "3" }]]))

        const page = await service.list("u1", WS, {}, "en")

        expect(chunks.placesOf).toHaveBeenCalledWith(WS, ["p1", "p2"])
        expect(page.nodes[0]?.evidence).toEqual([
            { ...quoted("p1"), placeKind: "page", placeLabel: "3" },
            quoted("p2"),
            quoted(null),
        ])
    })
})

describe("DossierFindingsService activeCount", () => {
    it("counts the findings that are open or confirmed in one count, with no list read", async () => {
        const em = mockEntityManager({ count: [DossierFindingEntity, 7] })
        const { service } = await build(em)

        await expect(service.activeCount(WS)).resolves.toBe(7)

        expect(em.count).toHaveBeenCalledWith(DossierFindingEntity, {
            where: { workspaceId: WS, status: In(["open", "confirmed"]) },
        })
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("DossierFindingsService list of nothing", () => {
    it("answers an empty page without reading findings when no draft awaits approval", async () => {
        const em = mockEntityManager({ find: [DossierRemedyDraftEntity, []] })
        const { service } = await build(em)

        await expect(service.list("u1", WS, { draftsAwaiting: true }, "vi")).resolves.toEqual({
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false },
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("answers an empty page with no cursor when nothing matches, empty filter lists left out", async () => {
        const em = mockEntityManager()
        const [query] = queueQueryBuilders(em, [{ getMany: [] }])
        const { service } = await build(em)

        await expect(service.list("u1", WS, { statuses: [], severities: [] }, "vi")).resolves.toEqual({
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false },
        })
        expect(query?.callsOf("andWhere")).toEqual([])
        expect(query?.callsOf("limit")).toEqual([[51]])
    })
})

describe("DossierFindingsService for an agent", () => {
    it("lists a page without asking who the member is, and the member's list asks first", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getMany: [] }, { getMany: [] }])
        const { service, members } = await build(em)

        await expect(service.listForAgent(WS, {}, "vi")).resolves.toEqual({
            nodes: [],
            pageInfo: { endCursor: null, hasNextPage: false },
        })
        expect(members.require).not.toHaveBeenCalled()

        await service.list("u1", WS, {}, "vi")
        expect(members.require).toHaveBeenCalledWith("u1", WS)
    })

    it("sums up the review without asking who the member is, and the member's summary asks first", async () => {
        const em = mockEntityManager({
            count: [DossierRemedyDraftEntity, 0],
            findOne: [DossierReviewRunEntity, null],
            exists: [DossierReviewRunEntity, false],
            find: [DossierReviewEntity, []],
        })
        queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [] }])
        const { service, members } = await build(em)

        await expect(service.summaryForAgent(WS)).resolves.toMatchObject({ open: 0, latestRun: null })
        expect(members.require).not.toHaveBeenCalled()

        await service.summary("u1", WS)
        expect(members.require).toHaveBeenCalledWith("u1", WS)
    })
})

describe("DossierFindingsService summary", () => {
    it("sums the active findings and lists the reviewed dossiers the checklist still names", async () => {
        const em = mockEntityManager({
            count: [DossierRemedyDraftEntity, 2],
            findOne: [DossierReviewRunEntity, runRowOf()],
            exists: [DossierReviewRunEntity, true],
            find: [DossierReviewEntity, [reviewRowOf(), reviewRowOf({ id: "rv2", dossierId: "gone" })]],
        })
        const [counts] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    { status: "open", severity: "critical", count: "2" },
                    { status: "open", severity: "high", count: 1 },
                    { status: "confirmed", severity: "low", count: "4" },
                ],
            },
        ])
        const { service } = await build(em)

        const summary = await service.summary("u1", WS)

        expect(summary).toMatchObject({
            open: 3,
            confirmed: 4,
            critical: 2,
            high: 1,
            draftsAwaiting: 2,
            isRunning: true,
        })
        expect(summary.latestRun).toMatchObject({ id: "r1", opened: 2, resolved: 1, dropped: 3 })
        expect(summary.dossiers).toEqual([
            {
                dossierId: "d1",
                status: "partial",
                checklistStatus: "present",
                openCount: 2,
                criticalCount: 0,
                highCount: 1,
                reviewedAt: AT.toISOString(),
            },
        ])
        expect(counts?.callsOf("where")).toEqual([
            [
                "f.workspaceId = :workspaceId AND f.status IN (:...statuses)",
                { workspaceId: WS, statuses: ["open", "confirmed"] },
            ],
        ])
        expect(em.exists).toHaveBeenCalledWith(DossierReviewRunEntity, {
            where: { workspaceId: WS, status: In(["queued", "running"]) },
        })
    })

    it("answers no latest run before the first one", async () => {
        const em = mockEntityManager({
            count: [DossierRemedyDraftEntity, 0],
            findOne: [DossierReviewRunEntity, null],
            exists: [DossierReviewRunEntity, false],
            find: [DossierReviewEntity, []],
        })
        queueQueryBuilders(em, [{ getRawMany: [] }])
        const { service } = await build(em)

        await expect(service.summary("u1", WS)).resolves.toMatchObject({ latestRun: null, open: 0, dossiers: [] })
    })
})

/** A manager whose finding reads `before` first and `after` once written. */
const decided = (before: DossierFindingEntity, after: DossierFindingEntity, affected = 1) => ({
    em: mockEntityManager({
        findOne: [DossierFindingEntity, before],
        update: [DossierFindingEntity, { affected }],
        findOneOrFail: [DossierFindingEntity, after],
        find: [DossierRemedyDraftEntity, []],
    }),
})

describe("DossierFindingsService decisions", () => {
    it("confirms an open finding with its note, recorded with the member and the time", async () => {
        const { em } = decided(findingOf(), findingOf({ status: "confirmed" }))
        const { service, members } = await build(em)

        await expect(service.confirm("u1", WS, { findingId: F1, note: "  checked  " }, "vi")).resolves.toMatchObject({
            status: "confirmed",
        })
        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(em.update).toHaveBeenCalledWith(
            DossierFindingEntity,
            { id: F1, workspaceId: WS, status: In(["open"]) },
            { status: "confirmed", decisionNote: "checked", decidedBy: "m1", decidedAt: AT },
        )
    })

    it("confirms without a note, and drops a note too short to say anything", async () => {
        const { em } = decided(findingOf(), findingOf({ status: "confirmed" }))
        const { service } = await build(em)

        await service.confirm("u1", WS, { findingId: F1 }, "vi")
        await service.confirm("u1", WS, { findingId: F1, note: "ok" }, "vi")

        expect(em.update).toHaveBeenNthCalledWith(
            1,
            DossierFindingEntity,
            expect.anything(),
            expect.objectContaining({ decisionNote: null }),
        )
        expect(em.update).toHaveBeenNthCalledWith(
            2,
            DossierFindingEntity,
            expect.anything(),
            expect.objectContaining({ decisionNote: null }),
        )
    })

    it("dismisses for a reason and keeps the evidence it had", async () => {
        const { em } = decided(findingOf({ status: "confirmed" }), findingOf({ status: "dismissed" }))
        const { service } = await build(em)

        await service.dismiss("u1", WS, { findingId: F1, reason: "Not relevant here" }, "vi")

        expect(em.update).toHaveBeenCalledWith(
            DossierFindingEntity,
            { id: F1, workspaceId: WS, status: In(["open", "confirmed"]) },
            {
                status: "dismissed",
                dismissReason: "Not relevant here",
                dismissedEvidenceHash: "h1",
                decisionNote: "Not relevant here",
                decidedBy: "m1",
                decidedAt: AT,
            },
        )
    })

    it("refuses a dismissal or a done mark without a reason of 3 to 500 characters", async () => {
        const { service } = await build(mockEntityManager())

        expect(thrownBy(() => service.dismiss("u1", WS, { findingId: F1, reason: " a " }, "vi"))).toMatchObject({
            code: DossierReviewErrorCode.ReasonRequired,
        })
        expect(thrownBy(() => service.resolve("u1", WS, { findingId: F1, note: "x".repeat(501) }, "vi"))).toMatchObject(
            { code: DossierReviewErrorCode.ReasonRequired },
        )
    })
})

describe("DossierFindingsService reopen, resolve and refusals", () => {
    it("reopens a dismissed or resolved finding and counts it", async () => {
        const { em } = decided(findingOf({ status: "resolved", reopenedCount: 2 }), findingOf())
        const { service } = await build(em)

        await service.reopen("u1", WS, { findingId: F1 }, "vi")

        expect(em.update).toHaveBeenCalledWith(
            DossierFindingEntity,
            { id: F1, workspaceId: WS, status: In(["dismissed", "resolved"]) },
            { status: "open", resolution: null, resolvedAt: null, reopenedCount: 3, decidedBy: "m1", decidedAt: AT },
        )
    })

    it("marks a finding done by hand with what was done", async () => {
        const { em } = decided(findingOf(), findingOf({ status: "resolved", resolution: "manual" }))
        const { service } = await build(em)

        await service.resolve("u1", WS, { findingId: F1, note: "The bank updated it" }, "vi")

        expect(em.update).toHaveBeenCalledWith(DossierFindingEntity, expect.anything(), {
            status: "resolved",
            resolution: "manual",
            resolvedAt: AT,
            decisionNote: "The bank updated it",
            decidedBy: "m1",
            decidedAt: AT,
        })
    })

    it("refuses a finding of another workspace, a status that does not allow the move, and a lost race", async () => {
        const { service: missing } = await build(mockEntityManager({ findOne: [DossierFindingEntity, null] }))
        await expect(missing.confirm("u1", WS, { findingId: F1 }, "vi")).rejects.toMatchObject({
            code: DossierReviewErrorCode.FindingNotFound,
        })
        const { service: closed } = await build(decided(findingOf({ status: "dismissed" }), findingOf()).em)
        await expect(closed.confirm("u1", WS, { findingId: F1 }, "vi")).rejects.toMatchObject({
            code: DossierReviewErrorCode.TransitionRefused,
        })
        const { service: raced } = await build(decided(findingOf(), findingOf(), 0).em)
        await expect(raced.confirm("u1", WS, { findingId: F1 }, "vi")).rejects.toMatchObject({
            code: DossierReviewErrorCode.TransitionRefused,
        })
    })
})

describe("DossierFindingsService assign", () => {
    it("gives an active finding to an active member with a due date, and takes it back", async () => {
        const { em } = decided(findingOf(), findingOf({ assigneeId: "m2", dueAt: "2026-11-15" }))
        const { service, lookup } = await build(em)
        lookup.activeById.mockResolvedValue({ id: "m2", displayName: "Nguyen Van A" })

        await expect(
            service.assign("u1", WS, { findingId: F1, assigneeId: "m2", dueAt: "2026-11-15" }, "vi"),
        ).resolves.toMatchObject({ assigneeId: "m2", dueAt: "2026-11-15" })
        await service.assign("u1", WS, { findingId: F1, assigneeId: null, dueAt: null }, "vi")

        expect(lookup.activeById).toHaveBeenCalledTimes(1)
        expect(lookup.activeById).toHaveBeenCalledWith(WS, "m2")
        expect(em.update).toHaveBeenLastCalledWith(
            DossierFindingEntity,
            { id: F1, workspaceId: WS, status: In(["open", "confirmed"]) },
            { assigneeId: null, dueAt: null },
        )
    })

    it("refuses an assignee who is not an active member", async () => {
        const { service, lookup } = await build(mockEntityManager())
        lookup.activeById.mockResolvedValue(null)

        await expect(
            service.assign("u1", WS, { findingId: F1, assigneeId: "stranger", dueAt: null }, "vi"),
        ).rejects.toMatchObject({ code: DossierReviewErrorCode.AssigneeNotMember })
    })
})
