import {
    at,
    member,
    row,
    item,
    editedEvidence,
    createdEvidence,
    legacyAttachments,
    completedRenderAttachments,
    selectedPillarInput,
    workbenchExpected,
    readingStatus,
} from "../../../tests/fixtures/builders/content-editor.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { And, In, LessThan, MoreThanOrEqual } from "typeorm"
import { ContentPillarsService } from "@modules/domain/content-pillars"
import { VideoRendersService } from "@modules/domain/video-renders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedCalls, evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { ContentEditorService } from "./content-editor.service"
import { ContentItemsErrorCode } from "./errors/content-items.error"
import { ContentItemEntity } from "./persistence/entities"

const ID = "00000000-0000-0000-0000-000000000001"
const rawRow = (patch: Record<string, unknown> = {}) => ({
    id: "item-1",
    workspace_id: "workspace-1",
    plan_id: null,
    title: "Launch",
    brief: "Explain launch",
    pillar_id: null,
    channels: ["facebook"],
    scheduled_at: null,
    status: "idea",
    variants: {},
    hashtags: [],
    media: [],
    links: [],
    holiday_key: null,
    evidence: [],
    published: {},
    work_item_id: null,
    drafted_at: null,
    approved_by: null,
    approved_at: null,
    published_at: null,
    source: "manual",
    created_by: "Mai",
    created_at: new Date(at),
    updated_at: new Date(at),
    ...patch,
})
const written = (patch: Record<string, unknown> = {}): QueryBuilderAnswers => ({ execute: { raw: [rawRow(patch)] } })

const build = async (em: MockEntityManager = mockEntityManager(), answers: ReadonlyArray<QueryBuilderAnswers> = []) => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const members = mock<WorkspaceMembersService>()
    const renders = mock<VideoRendersService>()
    const pillars = mock<ContentPillarsService>()
    members.require.mockResolvedValue(member)
    pillars.exists.mockResolvedValue(true)
    pillars.countActive.mockResolvedValue(0)
    pillars.countActiveAmong.mockResolvedValue(0)
    const transaction = fakeTransaction(em)
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentEditorService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoRendersService, useValue: renders },
            { provide: ContentPillarsService, useValue: pillars },
        ],
    }).compile()
    return {
        service: moduleRef.get(ContentEditorService),
        clock,
        entityManager: em,
        members,
        renders,
        pillars,
        transaction,
        fakes,
    }
}

/** The item scheduled at an instant. */
const rowAt = (iso: string): ContentItemEntity => row({ scheduledAt: new Date(iso) })

/** One call of the manager on the item table: the table and its options. */
const callOn = (options: object): [typeof ContentItemEntity, object] => [ContentItemEntity, options]

describe("ContentEditorService actor and reads", () => {
    it.each([
        ["owner", true],
        ["manager", true],
        ["staff", false],
    ] as const)("derives the %s member's management permission", async (role, canManage) => {
        const { service, members } = await build()
        members.require.mockResolvedValue({ ...member, role })
        await expect(service.actor("user-1", "workspace-1")).resolves.toEqual({
            workspaceId: "workspace-1",
            name: "Mai",
            canManage,
        })
        expect(members.require).toHaveBeenCalledWith("user-1", "workspace-1")
    })

    it("lists mapped posts using the default unbounded window", async () => {
        const em = mockEntityManager({ find: [ContentItemEntity, [row()]] })
        const { service, members } = await build(em)
        await expect(service.list("user-1", "workspace-1")).resolves.toEqual([item])
        expect(members.require).toHaveBeenCalledWith("user-1", "workspace-1")
        expect(evaluatedCalls(em.find.mock.calls)).toEqual([
            [
                "ContentItemEntity",
                {
                    where: { workspaceId: "workspace-1" },
                    order: { scheduledAt: { direction: "ASC", nulls: "LAST" }, createdAt: "DESC" },
                    take: 500,
                },
            ],
        ])
    })

    it.each([
        { range: { from: "2026-01-01" }, window: And(MoreThanOrEqual(new Date("2026-01-01"))) },
        { range: { to: "2026-02-01" }, window: And(LessThan(new Date("2026-02-01"))) },
        {
            range: { from: "2026-01-01", to: "2026-02-01" },
            window: And(MoreThanOrEqual(new Date("2026-01-01")), LessThan(new Date("2026-02-01"))),
        },
    ])("passes the validated calendar window %j", async ({ range, window }) => {
        const em = mockEntityManager({ find: [ContentItemEntity, []] })
        const { service } = await build(em)
        await expect(service.list("user-1", "workspace-1", range)).resolves.toEqual([])
        expect(em.find.mock.calls[0]?.[1]).toMatchObject({ where: { workspaceId: "workspace-1", scheduledAt: window } })
    })

    it.each([{ from: "invalid" }, { to: "invalid" }, { from: "2026-02-01", to: "2026-01-01" }])(
        "rejects an invalid window before reading %j",
        async (range) => {
            const { service, entityManager } = await build()
            await expect(service.list("user-1", "workspace-1", range)).rejects.toMatchObject({
                code: ContentItemsErrorCode.InvalidInput,
            })
            expect(entityManager.find).not.toHaveBeenCalled()
        },
    )

    it("reads a workspace-scoped item after proving the requesting member", async () => {
        const em = mockEntityManager({ findOne: [ContentItemEntity, row()] })
        const { service, members } = await build(em)
        await expect(service.getForUser("user-1", "workspace-1", "item-1")).resolves.toEqual(item)
        expect(members.require).toHaveBeenCalledWith("user-1", "workspace-1")
        expect(em.findOne.mock.calls).toEqual([callOn({ where: { workspaceId: "workspace-1", id: "item-1" } })])
    })
})

describe("ContentEditorService actor and reads", () => {
    it("reports a missing workspace item", async () => {
        const { service } = await build(mockEntityManager({ findOne: [ContentItemEntity, null] }))
        await expect(service.get("workspace-1", "missing")).rejects.toMatchObject({
            code: ContentItemsErrorCode.NotFound,
        })
    })
})

describe("ContentEditorService create", () => {
    it("verifies a selected pillar and preserves a supplied schedule", async () => {
        const { service, fakes, pillars, entityManager } = await build(mockEntityManager(), [written()])
        await expect(service.create("user-1", "workspace-1", selectedPillarInput)).resolves.toEqual(item)
        expect(pillars.exists).toHaveBeenCalledWith("workspace-1", "pillar-1", entityManager)
        expect(evaluatedValues(fakes[0]?.callsOf("values")[0]?.[0])).toEqual({
            workspaceId: "workspace-1",
            title: "x".repeat(200),
            channels: ["zalo"],
            scheduledAt: ":scheduledAt::timestamptz",
            pillarId: "pillar-1",
            status: "idea",
            source: "manual",
            createdBy: "Mai",
            evidence: ":evidence::jsonb",
        })
        expect(fakes[0]?.callsOf("setParameters")).toEqual([
            [{ scheduledAt: "2026-02-01", evidence: JSON.stringify(createdEvidence) }],
        ])
    })

    it.each([
        [[], { code: ContentItemsErrorCode.NotWritten }],
        [[null], { code: "DATABASE_RETURNING_ROW_REJECTED" }],
    ])("refuses a missing or malformed create result (%j)", async (raw, refusal) => {
        const { service } = await build(mockEntityManager(), [{ execute: { raw } }])
        await expect(
            service.create("user-1", "workspace-1", { title: "Launch", channels: ["facebook"], scheduledAt: null }),
        ).rejects.toMatchObject(refusal)
    })

    it("refuses a pillar outside the workspace", async () => {
        const em = mockEntityManager()
        const { service, fakes, pillars } = await build(em)
        pillars.exists.mockResolvedValue(false)
        await expect(
            service.create("user-1", "workspace-1", { title: "Launch", channels: ["facebook"], pillarId: "missing" }),
        ).rejects.toMatchObject({ code: ContentItemsErrorCode.InvalidInput })
        expect(fakes).toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("ContentEditorService save and move", () => {
    it.each([null, new Date("2025-12-01T00:00:00.000Z")])("retains draft time %s", async (draftedAt) => {
        const em = mockEntityManager(readingStatus("draft", draftedAt))
        const { service, fakes } = await build(em, [written()])
        const variants = { facebook: { text: "Draft", hashtags: [], note: "" } }
        await expect(service.save("user-1", "workspace-1", "item-1", { variants, media: [] })).resolves.toEqual(item)
        expect(fakes[0]?.callsOf("setParameters")).toEqual([
            [
                {
                    scheduledAt: null,
                    variants: JSON.stringify(variants),
                    links: "[]",
                    media: "[]",
                    draftedAt: draftedAt === null ? at : draftedAt.toISOString(),
                    evidence: JSON.stringify(editedEvidence),
                },
            ],
        ])
        expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0])).toMatchObject({ status: "draft", title: "Launch" })
        expect(fakes[0]?.callsOf("where")).toEqual([[{ workspaceId: "workspace-1", id: "item-1" }]])
    })

    it("checks completed renders once for distinct identifiers before saving attachments", async () => {
        const em = mockEntityManager({ findOne: [ContentItemEntity, row()] })
        const { service, renders, fakes } = await build(em, [written()])
        const media = completedRenderAttachments
        renders.findCompletedMedia.mockResolvedValue([
            { id: ID, title: "Video", outputPath: "video.mp4", durationMs: 10, createdAt: at },
        ])
        await expect(service.save("user-1", "workspace-1", "item-1", { media })).resolves.toEqual(item)
        expect(renders.findCompletedMedia).toHaveBeenCalledWith("workspace-1", [ID, ID])
        expect(fakes[0]?.callsOf("setParameters")[0]?.[0]).toMatchObject({ media: JSON.stringify(media) })
    })

    it("allows a schedule move with legacy attachments that have no completed-render identifier", async () => {
        const media = legacyAttachments
        const em = mockEntityManager(readingStatus("approved", null, media))
        const { service, renders, fakes } = await build(em, [written()])
        await expect(
            service.save("user-1", "workspace-1", "item-1", { scheduledAt: "2026-02-01", media: [] }),
        ).resolves.toEqual(item)
        expect(renders.findCompletedMedia).not.toHaveBeenCalled()
        expect(fakes[0]?.callsOf("setParameters")[0]?.[0]).toMatchObject({
            scheduledAt: "2026-02-01",
            media: JSON.stringify(media.map((attachment) => ({ ...attachment, suggested: false }))),
        })
        expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0])).toMatchObject({ status: "approved" })
    })

    it("rolls back when an attachment is not a completed workspace render", async () => {
        const em = mockEntityManager({ findOne: [ContentItemEntity, row()] })
        const { service, renders, transaction, fakes } = await build(em)
        renders.findCompletedMedia.mockResolvedValue([])
        await expect(
            service.save("user-1", "workspace-1", "item-1", {
                media: [{ kind: "video_render", name: "Video", id: ID }],
            }),
        ).rejects.toMatchObject({ code: ContentItemsErrorCode.InvalidInput })
        expect(fakes).toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it.each([true, false])("distinguishes a missing lock from a missing save result: %s", async (missingLock) => {
        const em = mockEntityManager({ findOne: [ContentItemEntity, missingLock ? null : row()] })
        const { service, transaction } = await build(em, [{ execute: { raw: [] } }])
        await expect(service.save("user-1", "workspace-1", "item-1", {})).rejects.toMatchObject({
            code: missingLock ? ContentItemsErrorCode.NotFound : ContentItemsErrorCode.NotWritten,
        })
        expect(transaction.outcomes).toEqual(["rollback"])
    })
})

describe("ContentEditorService save and move", () => {
    it("moves by saving only the new calendar instant under the row lock", async () => {
        const em = mockEntityManager({ findOne: [ContentItemEntity, row()] })
        const { service, members, transaction, fakes } = await build(em, [written()])
        await expect(service.move("user-1", "workspace-1", "item-1", "2026-02-01")).resolves.toEqual(item)
        expect(members.require).toHaveBeenCalledWith("user-1", "workspace-1", ["owner", "manager"])
        expect(em.findOne.mock.calls).toEqual([
            callOn({ where: { workspaceId: "workspace-1", id: "item-1" }, lock: { mode: "pessimistic_write" } }),
        ])
        expect(fakes[0]?.callsOf("setParameters")[0]?.[0]).toMatchObject({ scheduledAt: "2026-02-01" })
        expect(transaction.outcomes).toEqual(["commit"])
    })
})

describe("ContentEditorService transition", () => {
    it("deletes a permitted idea under the transaction lock", async () => {
        const em = mockEntityManager({
            findOne: [ContentItemEntity, row()],
            delete: [ContentItemEntity, { affected: 1 }],
        })
        const { service, transaction } = await build(em)
        await expect(service.transition("user-1", "workspace-1", "item-1", "delete")).resolves.toEqual({ id: "item-1" })
        expect(em.delete.mock.calls).toEqual([
            callOn({ workspaceId: "workspace-1", id: "item-1", status: In(["idea", "draft", "skipped"]) }),
        ])
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("refuses deletion after approval", async () => {
        const em = mockEntityManager(readingStatus("approved"))
        const { service, transaction } = await build(em)
        await expect(service.transition("user-1", "workspace-1", "item-1", "delete")).rejects.toMatchObject({
            code: ContentItemsErrorCode.WrongStatus,
        })
        expect(em.findOne).toHaveBeenCalledTimes(1)
        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it.each([
        ["drop an idea aside", "skip", "idea", "skipped", false],
        ["bring an approved item back", "reopen", "approved", "draft", true],
    ] as const)("records the transition that would %s", async (_label, kind, status, next, reopen) => {
        const em = mockEntityManager(readingStatus(status))
        const { service, fakes } = await build(em, [{ execute: {} }])
        await expect(service.transition("user-1", "workspace-1", "item-1", kind)).resolves.toEqual({ id: "item-1" })
        expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0])).toEqual({
            status: next,
            evidence: ":evidence::jsonb",
            ...(reopen ? { approvedBy: null, approvedAt: null } : {}),
        })
        expect(fakes[0]?.callsOf("setParameter")).toEqual([
            ["evidence", JSON.stringify([{ at, kind, by: "Mai", text: kind }])],
        ])
    })
})

describe("ContentEditorService figures and workbench", () => {
    const figuresStubs = (upcoming: ContentItemEntity | null, counts: [number, number]) => ({
        count: [
            [ContentItemEntity, counts[0]],
            [ContentItemEntity, counts[1]],
        ] as const,
        findOne: [ContentItemEntity, upcoming] as const,
        find: [ContentItemEntity, []] as const,
    })

    it("computes Vietnam month boundaries and maps live figures and the upcoming post", async () => {
        const em = mockEntityManager(figuresStubs(rowAt("2026-01-02T00:00:00Z"), [2, 4]))
        const { service, fakes, pillars } = await build(em, [{ getRawMany: [{ pillarId: "pillar-1" }] }])
        pillars.countActive.mockResolvedValue(5)
        pillars.countActiveAmong.mockResolvedValue(3)
        await expect(service.figures("user-1", "workspace-1")).resolves.toEqual({
            awaitingApproval: 2,
            published30: 4,
            next: { at: "2026-01-02T00:00:00.000Z", title: "Launch" },
            pillars: { covered: 3, total: 5 },
        })
        expect(fakes[0]?.callsOf("andWhere")[0]?.[1]).toEqual({
            from: new Date("2025-12-31T17:00:00.000Z"),
            to: new Date("2026-01-31T17:00:00.000Z"),
        })
        expect(pillars.countActiveAmong).toHaveBeenCalledWith("workspace-1", ["pillar-1"])
        expect(em.count.mock.calls[1]?.[1]).toMatchObject({
            where: {
                workspaceId: "workspace-1",
                status: "published",
                publishedAt: MoreThanOrEqual(new Date("2025-12-02T00:00:00.000Z")),
            },
        })
        expect(em.findOne.mock.calls[0]?.[1]).toMatchObject({
            where: { workspaceId: "workspace-1", status: "approved", scheduledAt: MoreThanOrEqual(new Date(at)) },
        })
    })

    it.each([null, row()])("has no next post when none is scheduled: %j", async (upcoming) => {
        const { service } = await build(mockEntityManager(figuresStubs(upcoming, [0, 0])), [{ getRawMany: [] }])
        await expect(service.figures("user-1", "workspace-1")).resolves.toEqual({
            awaitingApproval: 0,
            published30: 0,
            next: null,
            pillars: { covered: 0, total: 0 },
        })
    })

    it.each([true, false])("assembles the authorized workbench with an optional last plan: %s", async (hasPlan) => {
        const { service } = await build(mockEntityManager(figuresStubs(null, [0, 0])), [{ getRawMany: [] }])
        const readPlan = jest.fn(() =>
            Promise.resolve(hasPlan ? { month: "2025-12", ideas: 8, ms: 45, createdAt: new Date(at) } : undefined),
        )
        await expect(service.workbench("user-1", "workspace-1", readPlan)).resolves.toEqual(workbenchExpected(hasPlan))
        expect(readPlan).toHaveBeenCalledWith("workspace-1")
    })
})
