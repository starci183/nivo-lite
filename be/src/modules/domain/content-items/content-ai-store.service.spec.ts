import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentAiStoreService } from "./content-ai-store.service"
import { ContentItemsErrorCode } from "./errors/content-items.error"
import {
    APPLY_GENERATED_DRAFT,
    DELETE_UNTOUCHED_PLAN_IDEAS,
    INSERT_PLANNED_IDEAS,
    INSERT_QUICK_IDEA,
    SELECT_RECENT_CONTENT_TITLES,
} from "./persistence/content-ai-store.sql"

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentAiStoreService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { service: moduleRef.get(ContentAiStoreService), clock, entityManager, members }
}

describe("ContentAiStoreService", () => {
    describe("createQuickIdea", () => {
        it("createQuickIdea has its first case written", async () => {
            const { service } = await build()
            expect(service.createQuickIdea).toBeInstanceOf(Function)
        })
    })

    describe("applyDraft", () => {
        it("applyDraft has its first case written", async () => {
            const { service } = await build()
            expect(service.applyDraft).toBeInstanceOf(Function)
        })
    })

    describe("recentTitles", () => {
        it("recentTitles has its first case written", async () => {
            const { service } = await build()
            expect(service.recentTitles).toBeInstanceOf(Function)
        })
    })

    describe("insertPlannedIdeas", () => {
        it("insertPlannedIdeas has its first case written", async () => {
            const { service } = await build()
            expect(service.insertPlannedIdeas).toBeInstanceOf(Function)
        })
    })
})

describe("ContentAiStoreService writes", () => {
    const member = {
        userId: "user-1",
        workspaceId: "workspace-1",
        role: "owner" as const,
        staffId: null,
        displayName: "Mai",
        status: "active" as const,
    }
    const variants = { facebook: { text: "Draft", hashtags: ["launch"], note: "Friendly" } }

    it("creates a bounded first-line title with membership identity and normalizes the revision", async () => {
        const { service, entityManager, members } = await build()
        members.require.mockResolvedValue(member)
        entityManager.query.mockResolvedValue([{ id: "idea-1", updated_at: new Date("2026-01-01T07:00:00+07:00") }])
        const topic = `${"a".repeat(90)}\nFull brief`
        await expect(
            service.createQuickIdea("user-1", "workspace-1", { topic, channels: ["facebook", "zalo"] }),
        ).resolves.toEqual({ id: "idea-1", updatedAt: "2026-01-01T00:00:00.000Z" })
        expect(members.require).toHaveBeenCalledWith("user-1", "workspace-1", ["owner", "manager"])
        expect(entityManager.query).toHaveBeenCalledWith(INSERT_QUICK_IDEA, [
            "workspace-1",
            "a".repeat(80),
            topic,
            ["facebook", "zalo"],
            "Mai",
        ])
    })

    it("uses the supplied transaction and falls back to the user identity for an unnamed member", async () => {
        const { service, entityManager, members } = await build()
        const tx = mockEntityManager({
            query: [INSERT_QUICK_IDEA, [{ id: "idea-2", updated_at: "2026-01-02T00:00:00Z" }]],
        })
        members.require.mockResolvedValue({ ...member, displayName: "" })
        await expect(
            service.createQuickIdea("user-1", "workspace-1", { topic: "", channels: ["facebook"] }, tx),
        ).resolves.toEqual({ id: "idea-2", updatedAt: "2026-01-02T00:00:00.000Z" })
        expect(tx.query).toHaveBeenCalledWith(INSERT_QUICK_IDEA, ["workspace-1", "", "", ["facebook"], "user-1"])
        expect(entityManager.query).not.toHaveBeenCalled()
    })

    it("refuses a quick idea insert that returns no row", async () => {
        const { service, entityManager, members } = await build()
        members.require.mockResolvedValue(member)
        entityManager.query.mockResolvedValue([])
        await expect(
            service.createQuickIdea("user-1", "workspace-1", { topic: "Launch", channels: ["facebook"] }),
        ).rejects.toMatchObject({ code: ContentItemsErrorCode.NotWritten })
    })

    it("applies a minimal draft using null optional values and empty evidence", async () => {
        const { service, entityManager } = await build()
        entityManager.query.mockResolvedValue([{ id: "idea-1" }])
        await expect(service.applyDraft("workspace-1", "idea-1", { variants, hashtags: ["launch"] })).resolves.toEqual({
            id: "idea-1",
        })
        expect(entityManager.query).toHaveBeenCalledWith(APPLY_GENERATED_DRAFT, [
            "idea-1",
            "workspace-1",
            JSON.stringify(variants),
            ["launch"],
            null,
            null,
            null,
            null,
            null,
            "[]",
            null,
        ])
    })

    it("serializes a complete draft into the supplied transaction", async () => {
        const { service, entityManager } = await build()
        const tx = mockEntityManager({ query: [APPLY_GENERATED_DRAFT, [{ id: "idea-1" }]] })
        const media = [{ kind: "media", name: "Photo", path: "workspace-1/photo.jpg" }]
        const evidence = [{ at: "2026-01-01T00:00:00Z", kind: "drafted", by: "NIVO", text: "AI draft" }]
        await expect(
            service.applyDraft(
                "workspace-1",
                "idea-1",
                {
                    variants,
                    hashtags: ["launch"],
                    media,
                    channels: ["facebook"],
                    pillarId: "pillar-1",
                    title: "Launch",
                    draftedAt: "2026-01-01T00:00:00Z",
                    evidence,
                    expectedUpdatedAt: "2025-12-31T00:00:00Z",
                },
                tx,
            ),
        ).resolves.toEqual({ id: "idea-1" })
        expect(tx.query).toHaveBeenCalledWith(APPLY_GENERATED_DRAFT, [
            "idea-1",
            "workspace-1",
            JSON.stringify(variants),
            ["launch"],
            JSON.stringify(media),
            ["facebook"],
            "pillar-1",
            "Launch",
            "2026-01-01T00:00:00Z",
            JSON.stringify(evidence),
            "2025-12-31T00:00:00Z",
        ])
        expect(entityManager.query).not.toHaveBeenCalled()
    })

    it("refuses a draft that no longer has an editable row", async () => {
        const { service, entityManager } = await build()
        entityManager.query.mockResolvedValue([])
        await expect(service.applyDraft("workspace-1", "idea-1", { variants, hashtags: [] })).rejects.toMatchObject({
            code: ContentItemsErrorCode.NotWritten,
        })
    })

    it("returns only the recent titles in database order", async () => {
        const { service, entityManager } = await build()
        entityManager.query.mockResolvedValue([{ title: "Latest" }, { title: "Earlier" }])
        await expect(service.recentTitles("workspace-1", "idea-1")).resolves.toEqual(["Latest", "Earlier"])
        expect(entityManager.query).toHaveBeenCalledWith(SELECT_RECENT_CONTENT_TITLES, ["workspace-1", "idea-1"])
    })

    it("replaces untouched ideas and serializes planned ideas and clock evidence", async () => {
        const { service, entityManager } = await build()
        const tx = mockEntityManager({
            query: [
                [DELETE_UNTOUCHED_PLAN_IDEAS, []],
                [INSERT_PLANNED_IDEAS, [{ id: "idea-1" }]],
            ],
        })
        await expect(
            service.insertPlannedIdeas(
                "workspace-1",
                "plan-1",
                {
                    month: "2026-01",
                    actor: "Mai",
                    meta: {},
                    generationId: "generation-1",
                    aiMs: 50,
                    items: [
                        {
                            title: "Launch",
                            brief: "Explain launch",
                            pillarId: "pillar-1",
                            channels: ["facebook"],
                            scheduledAt: "2026-01-02T00:00:00Z",
                            holidayKey: null,
                        },
                    ],
                },
                tx,
            ),
        ).resolves.toBe(1)
        expect(tx.query).toHaveBeenNthCalledWith(1, DELETE_UNTOUCHED_PLAN_IDEAS, ["workspace-1", "2026-01-01"])
        expect(tx.query).toHaveBeenNthCalledWith(2, INSERT_PLANNED_IDEAS, [
            "workspace-1",
            "plan-1",
            JSON.stringify([
                {
                    title: "Launch",
                    brief: "Explain launch",
                    pillar_id: "pillar-1",
                    channels: ["facebook"],
                    scheduled_at: "2026-01-02T00:00:00Z",
                    holiday_key: null,
                },
            ]),
            "Mai",
            JSON.stringify([{ at: "2026-01-01T00:00:00.000Z", kind: "planned", by: "NIVO", text: "2026-01" }]),
        ])
        expect(entityManager.query).not.toHaveBeenCalled()
    })

    it("refuses a plan when the inserted count does not match its items", async () => {
        const { service } = await build()
        const tx = mockEntityManager({
            query: [
                [DELETE_UNTOUCHED_PLAN_IDEAS, []],
                [INSERT_PLANNED_IDEAS, [{ id: "unexpected" }]],
            ],
        })
        await expect(
            service.insertPlannedIdeas(
                "workspace-1",
                "plan-1",
                {
                    month: "2026-01",
                    actor: "Mai",
                    meta: {},
                    generationId: "generation-1",
                    aiMs: 0,
                    items: [],
                },
                tx,
            ),
        ).rejects.toMatchObject({ code: ContentItemsErrorCode.NotWritten })
    })
})
