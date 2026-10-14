import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { VideoRendersService } from "@modules/domain/video-renders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentEditorService } from "./content-editor.service"
import { ContentItemsErrorCode } from "./errors/content-items.error"
import type { ContentEditorRow } from "./persistence/content-editor.rows"
import {
    CONTENT_FIGURES,
    CREATE_CONTENT_ITEM,
    DELETE_CONTENT_ITEM,
    FIND_CONTENT_ITEM,
    FIND_CONTENT_PILLAR,
    LAST_CONTENT_PLAN,
    LIST_CONTENT_ITEMS,
    LOCK_CONTENT_ITEM,
    NEXT_CONTENT_ITEM,
    SAVE_CONTENT_ITEM,
    TRANSITION_CONTENT_ITEM,
} from "./persistence/content-editor.sql"

const at = "2026-01-01T00:00:00.000Z"
const member = {
    userId: "user-1",
    workspaceId: "workspace-1",
    role: "owner" as const,
    staffId: null,
    displayName: "Mai",
    status: "active" as const,
}
const shared = {
    id: "item-1",
    title: "Launch",
    brief: "Explain launch",
    channels: ["facebook"],
    status: "idea",
    variants: {},
    hashtags: [],
    media: [],
    links: [],
    evidence: [],
    published: {},
    source: "manual",
}
const row = (patch: Partial<ContentEditorRow> = {}): ContentEditorRow => ({
    ...shared,
    workspace_id: "workspace-1",
    plan_id: null,
    pillar_id: null,
    scheduled_at: null,
    holiday_key: null,
    work_item_id: null,
    drafted_at: null,
    approved_by: null,
    approved_at: null,
    published_at: null,
    created_by: "Mai",
    created_at: new Date(at),
    updated_at: at,
    ...patch,
})
const item = {
    ...shared,
    workspaceId: "workspace-1",
    planId: null,
    pillarId: null,
    scheduledAt: null,
    holidayKey: null,
    workItemId: null,
    draftedAt: null,
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
    createdBy: "Mai",
    createdAt: at,
    updatedAt: at,
}
const edited = JSON.stringify([{ at, kind: "edited", by: "Mai", text: "edited" }])

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const renders = mock<VideoRendersService>()
    members.require.mockResolvedValue(member)
    const transaction = fakeTransaction(entityManager)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentEditorService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoRendersService, useValue: renders },
        ],
    }).compile()
    return { service: moduleRef.get(ContentEditorService), clock, entityManager, members, renders, transaction }
}

describe("ContentEditorService", () => {
    describe("actor", () => {
        it("actor has its first case written", async () => {
            const { service } = await build()
            expect(service.actor).toBeInstanceOf(Function)
        })
    })

    describe("list", () => {
        it("list has its first case written", async () => {
            const { service } = await build()
            expect(service.list).toBeInstanceOf(Function)
        })
    })

    describe("get", () => {
        it("get has its first case written", async () => {
            const { service } = await build()
            expect(service.get).toBeInstanceOf(Function)
        })
    })

    describe("getForUser", () => {
        it("getForUser has its first case written", async () => {
            const { service } = await build()
            expect(service.getForUser).toBeInstanceOf(Function)
        })
    })

    describe("create", () => {
        it("create has its first case written", async () => {
            const { service } = await build()
            expect(service.create).toBeInstanceOf(Function)
        })
    })

    describe("save", () => {
        it("save has its first case written", async () => {
            const { service } = await build()
            expect(service.save).toBeInstanceOf(Function)
        })
    })

    describe("move", () => {
        it("move has its first case written", async () => {
            const { service } = await build()
            expect(service.move).toBeInstanceOf(Function)
        })
    })

    describe("transition", () => {
        it("transition has its first case written", async () => {
            const { service } = await build()
            expect(service.transition).toBeInstanceOf(Function)
        })
    })

    describe("figures", () => {
        it("figures has its first case written", async () => {
            const { service } = await build()
            expect(service.figures).toBeInstanceOf(Function)
        })
    })

    describe("workbench", () => {
        it("workbench has its first case written", async () => {
            const { service } = await build()
            expect(service.workbench).toBeInstanceOf(Function)
        })
    })
})

describe("ContentEditorService behavior", () => {
    it.each([
        ["owner", true],
        ["manager", true],
        ["staff", false],
    ] as const)("derives the %s member's management permission", async (role, canManage) => {
        const { service, members } = await build()
        members.require.mockResolvedValue({ ...member, role })
        const actor = { workspaceId: "workspace-1", name: "Mai", canManage }
        await expect(service.actor("user-1", "workspace-1")).resolves.toEqual(actor)
        expect(members.require).toHaveBeenCalledWith("user-1", "workspace-1")
    })

    it("lists mapped posts using the default unbounded window", async () => {
        const { service, entityManager, members } = await build()
        entityManager.query.mockResolvedValue([row()])
        await expect(service.list("user-1", "workspace-1")).resolves.toEqual([item])
        expect(members.require).toHaveBeenCalledWith("user-1", "workspace-1")
        expect(entityManager.query).toHaveBeenCalledWith(LIST_CONTENT_ITEMS, ["workspace-1", null, null])
    })

    it.each([{ from: "2026-01-01" }, { to: "2026-02-01" }, { from: "2026-01-01", to: "2026-02-01" }])(
        "passes the validated calendar window %j",
        async (range) => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValue([])
            await expect(service.list("user-1", "workspace-1", range)).resolves.toEqual([])
            expect(entityManager.query).toHaveBeenCalledWith(LIST_CONTENT_ITEMS, [
                "workspace-1",
                range.from ?? null,
                range.to ?? null,
            ])
        },
    )

    it.each([{ from: "invalid" }, { to: "invalid" }, { from: "2026-02-01", to: "2026-01-01" }])(
        "rejects an invalid window before reading %j",
        async (range) => {
            const { service, entityManager } = await build()
            await expect(service.list("user-1", "workspace-1", range)).rejects.toMatchObject({
                code: ContentItemsErrorCode.InvalidInput,
            })
            expect(entityManager.query).not.toHaveBeenCalled()
        },
    )

    it("reads a workspace-scoped item after proving the requesting member", async () => {
        const { service, entityManager, members } = await build()
        entityManager.query.mockResolvedValue([row()])
        await expect(service.getForUser("user-1", "workspace-1", "item-1")).resolves.toEqual(item)
        expect(members.require).toHaveBeenCalledWith("user-1", "workspace-1")
        expect(entityManager.query).toHaveBeenCalledWith(FIND_CONTENT_ITEM, ["workspace-1", "item-1"])
    })

    it("reports a missing workspace item", async () => {
        const { service, entityManager } = await build()
        entityManager.query.mockResolvedValue([])
        await expect(service.get("workspace-1", "missing")).rejects.toMatchObject({
            code: ContentItemsErrorCode.NotFound,
        })
    })

    it("verifies a selected pillar and preserves a supplied schedule", async () => {
        const { service, entityManager } = await build()
        entityManager.query.mockResolvedValueOnce([{ id: "pillar-1" }]).mockResolvedValueOnce([row()])
        await expect(
            service.create("user-1", "workspace-1", {
                title: "x".repeat(210),
                channels: ["zalo"],
                pillarId: "pillar-1",
                scheduledAt: "2026-02-01",
            }),
        ).resolves.toEqual(item)
        expect(entityManager.query).toHaveBeenNthCalledWith(1, FIND_CONTENT_PILLAR, ["workspace-1", "pillar-1"])
        expect(entityManager.query).toHaveBeenNthCalledWith(2, CREATE_CONTENT_ITEM, [
            "workspace-1",
            "x".repeat(200),
            ["zalo"],
            "2026-02-01",
            "pillar-1",
            "Mai",
            JSON.stringify([{ at, kind: "created", by: "Mai", text: "created" }]),
        ])
    })

    it("refuses a missing create result", async () => {
        const { service, entityManager } = await build()
        entityManager.query.mockResolvedValue([])
        await expect(
            service.create("user-1", "workspace-1", { title: "Launch", channels: ["facebook"], scheduledAt: null }),
        ).rejects.toMatchObject({ code: ContentItemsErrorCode.NotWritten })
    })

    it("refuses a pillar outside the workspace", async () => {
        const { service, entityManager } = await build()
        entityManager.query.mockResolvedValue([])
        await expect(
            service.create("user-1", "workspace-1", { title: "Launch", channels: ["facebook"], pillarId: "missing" }),
        ).rejects.toMatchObject({ code: ContentItemsErrorCode.InvalidInput })
        expect(entityManager.query).toHaveBeenCalledTimes(1)
    })

    it.each([null, "2025-12-01T00:00:00.000Z"])("retains draft time %s", async (draftedAt) => {
        const { service, entityManager } = await build()
        const variants = { facebook: { text: "Draft", hashtags: [], note: "" } }
        entityManager.query
            .mockResolvedValueOnce([row({ status: "draft", drafted_at: draftedAt })])
            .mockResolvedValueOnce([row()])
        await expect(service.save("user-1", "workspace-1", "item-1", { variants, media: [] })).resolves.toEqual(item)
        expect(entityManager.query).toHaveBeenLastCalledWith(SAVE_CONTENT_ITEM, [
            "workspace-1",
            "item-1",
            "Launch",
            "Explain launch",
            null,
            ["facebook"],
            null,
            JSON.stringify(variants),
            [],
            "[]",
            "[]",
            "draft",
            draftedAt ?? at,
            edited,
        ])
    })

    it("checks completed renders once for distinct identifiers before saving attachments", async () => {
        const { service, entityManager, renders } = await build()
        const id = "00000000-0000-0000-0000-000000000001"
        const media = [
            { kind: "video_render", name: "Video", id },
            { kind: "video_render", name: "Duplicate", id },
        ]
        entityManager.query.mockResolvedValueOnce([row()]).mockResolvedValueOnce([row()])
        renders.findCompletedMedia.mockResolvedValue([
            { id, title: "Video", outputPath: "video.mp4", durationMs: 10, createdAt: at },
        ])
        await expect(service.save("user-1", "workspace-1", "item-1", { media })).resolves.toEqual(item)
        expect(renders.findCompletedMedia).toHaveBeenCalledWith("workspace-1", [id, id])
        expect(entityManager.query).toHaveBeenLastCalledWith(SAVE_CONTENT_ITEM, [
            "workspace-1",
            "item-1",
            "Launch",
            "Explain launch",
            null,
            ["facebook"],
            null,
            "{}",
            [],
            "[]",
            JSON.stringify(media),
            "idea",
            null,
            edited,
        ])
    })

    it("allows a schedule move with legacy attachments that have no completed-render identifier", async () => {
        const { service, entityManager, renders } = await build()
        const media = [
            { kind: "video_render", name: "Legacy" },
            { kind: "media", name: "Photo", path: "workspace-1/photo.jpg" },
        ]
        entityManager.query.mockResolvedValueOnce([row({ status: "approved", media })]).mockResolvedValueOnce([row()])
        await expect(
            service.save("user-1", "workspace-1", "item-1", { scheduledAt: "2026-02-01", media: [] }),
        ).resolves.toEqual(item)
        expect(renders.findCompletedMedia).not.toHaveBeenCalled()
        expect(entityManager.query).toHaveBeenLastCalledWith(SAVE_CONTENT_ITEM, [
            "workspace-1",
            "item-1",
            "Launch",
            "Explain launch",
            null,
            ["facebook"],
            "2026-02-01",
            "{}",
            [],
            "[]",
            JSON.stringify(media.map((attachment) => ({ ...attachment, suggested: false }))),
            "approved",
            null,
            edited,
        ])
    })

    it("rolls back when an attachment is not a completed workspace render", async () => {
        const { service, entityManager, renders, transaction } = await build()
        entityManager.query.mockResolvedValue([row()])
        renders.findCompletedMedia.mockResolvedValue([])
        await expect(
            service.save("user-1", "workspace-1", "item-1", {
                media: [{ kind: "video_render", name: "Video", id: "00000000-0000-0000-0000-000000000001" }],
            }),
        ).rejects.toMatchObject({ code: ContentItemsErrorCode.InvalidInput })
        expect(entityManager.query).toHaveBeenCalledTimes(1)
        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it.each([true, false])("distinguishes a missing lock from a missing save result: %s", async (missingLock) => {
        const { service, entityManager, transaction } = await build()
        entityManager.query.mockResolvedValueOnce(missingLock ? [] : [row()]).mockResolvedValueOnce([])
        await expect(service.save("user-1", "workspace-1", "item-1", {})).rejects.toMatchObject({
            code: missingLock ? ContentItemsErrorCode.NotFound : ContentItemsErrorCode.NotWritten,
        })
        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it("moves by saving only the new calendar instant", async () => {
        const { service, entityManager, transaction, members } = await build()
        entityManager.query.mockResolvedValueOnce([row()]).mockResolvedValueOnce([row()])
        await expect(service.move("user-1", "workspace-1", "item-1", "2026-02-01")).resolves.toEqual(item)
        expect(members.require).toHaveBeenCalledWith("user-1", "workspace-1", ["owner", "manager"])
        expect(entityManager.query).toHaveBeenNthCalledWith(1, LOCK_CONTENT_ITEM, ["workspace-1", "item-1"])
        expect(entityManager.query).toHaveBeenLastCalledWith(SAVE_CONTENT_ITEM, [
            "workspace-1",
            "item-1",
            "Launch",
            "Explain launch",
            null,
            ["facebook"],
            "2026-02-01",
            "{}",
            [],
            "[]",
            "[]",
            "idea",
            null,
            edited,
        ])
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("deletes a permitted idea under the transaction lock", async () => {
        const { service, entityManager, transaction } = await build()
        entityManager.query.mockResolvedValueOnce([row()]).mockResolvedValueOnce([])
        await expect(service.transition("user-1", "workspace-1", "item-1", "delete")).resolves.toEqual({ id: "item-1" })
        expect(entityManager.query).toHaveBeenLastCalledWith(DELETE_CONTENT_ITEM, ["workspace-1", "item-1"])
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("refuses deletion after approval", async () => {
        const { service, entityManager, transaction } = await build()
        entityManager.query.mockResolvedValue([row({ status: "approved" })])
        await expect(service.transition("user-1", "workspace-1", "item-1", "delete")).rejects.toMatchObject({
            code: ContentItemsErrorCode.WrongStatus,
        })
        expect(entityManager.query).toHaveBeenCalledTimes(1)
        expect(transaction.outcomes).toEqual(["rollback"])
    })

    it.each([
        ["skip", "idea", "skipped", false],
        ["reopen", "approved", "draft", true],
    ] as const)("records the %s transition", async (kind, status, next, reopen) => {
        const { service, entityManager } = await build()
        entityManager.query.mockResolvedValueOnce([row({ status })]).mockResolvedValueOnce([])
        await expect(service.transition("user-1", "workspace-1", "item-1", kind)).resolves.toEqual({ id: "item-1" })
        expect(entityManager.query).toHaveBeenLastCalledWith(TRANSITION_CONTENT_ITEM, [
            "workspace-1",
            "item-1",
            next,
            JSON.stringify([{ at, kind, by: "Mai", text: kind }]),
            reopen,
        ])
    })

    it("computes Vietnam month boundaries and maps live figures and the upcoming post", async () => {
        const { service, entityManager } = await build()
        entityManager.query
            .mockResolvedValueOnce([{ awaiting_approval: 2, published_30: 4, covered: 3, total: 5 }])
            .mockResolvedValueOnce([row({ scheduled_at: new Date("2026-01-02T00:00:00Z") })])
        await expect(service.figures("user-1", "workspace-1")).resolves.toEqual({
            awaitingApproval: 2,
            published30: 4,
            next: { at: "2026-01-02T00:00:00.000Z", title: "Launch" },
            pillars: { covered: 3, total: 5 },
        })
        expect(entityManager.query).toHaveBeenNthCalledWith(1, CONTENT_FIGURES, [
            "workspace-1",
            at,
            "2025-12-31T17:00:00.000Z",
            "2026-01-31T17:00:00.000Z",
        ])
        expect(entityManager.query).toHaveBeenNthCalledWith(2, NEXT_CONTENT_ITEM, ["workspace-1", at])
    })

    it.each([{ upcoming: [] }, { upcoming: [row()] }])(
        "returns empty figures when counts or a scheduled post are absent: %j",
        async ({ upcoming }) => {
            const { service, entityManager } = await build()
            entityManager.query.mockResolvedValueOnce([]).mockResolvedValueOnce(upcoming)
            await expect(service.figures("user-1", "workspace-1")).resolves.toEqual({
                awaitingApproval: 0,
                published30: 0,
                next: null,
                pillars: { covered: 0, total: 0 },
            })
        },
    )

    it.each([true, false])("assembles the authorized workbench with an optional last plan: %s", async (hasPlan) => {
        const { service, entityManager } = await build()
        entityManager.query.mockImplementation((sql) =>
            Promise.resolve(
                sql === LAST_CONTENT_PLAN && hasPlan
                    ? [{ month: "2025-12", idea_count: 8, ai_ms: 45, created_at: new Date(at) }]
                    : [],
            ),
        )
        await expect(service.workbench("user-1", "workspace-1")).resolves.toEqual({
            nowIso: at,
            workspaceId: "workspace-1",
            canManage: true,
            actor: { workspaceId: "workspace-1", name: "Mai", canManage: true },
            items: [],
            figures: { awaitingApproval: 0, published30: 0, next: null, pillars: { covered: 0, total: 0 } },
            lastPlan: hasPlan ? { month: "2025-12", ideas: 8, ms: 45, createdAt: at } : null,
        })
        expect(entityManager.query).toHaveBeenCalledWith(LAST_CONTENT_PLAN, ["workspace-1"])
    })
})
