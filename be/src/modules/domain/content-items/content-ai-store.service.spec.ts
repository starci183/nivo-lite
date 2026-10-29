import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Not } from "typeorm"
import { ContentPillarsService } from "@modules/domain/content-pillars"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedCalls, evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { ContentAiStoreService } from "./content-ai-store.service"
import { ContentItemsErrorCode } from "./errors/content-items.error"
import { ContentItemEntity } from "./persistence/entities"

const build = async (
    answers: ReadonlyArray<QueryBuilderAnswers> = [],
    entityManager: MockEntityManager = mockEntityManager(),
) => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const members = mock<WorkspaceMembersService>()
    const pillars = mock<ContentPillarsService>()
    pillars.exists.mockResolvedValue(true)
    pillars.known.mockResolvedValue([])
    const fakes = queueQueryBuilders(entityManager, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentAiStoreService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ContentPillarsService, useValue: pillars },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { service: moduleRef.get(ContentAiStoreService), clock, entityManager, members, fakes, pillars }
}

const member = {
    userId: "user-1",
    workspaceId: "workspace-1",
    role: "owner" as const,
    staffId: null,
    displayName: "Mai",
    status: "active" as const,
}

const variants = { facebook: { text: "Draft", hashtags: ["launch"], note: "Friendly" } }
const quick = (updatedAt: string | Date) => ({ execute: { raw: [{ id: "idea-1", updated_at: updatedAt }] } })

describe("ContentAiStoreService createQuickIdea", () => {
    it("creates a bounded first-line title with membership identity and normalizes the revision", async () => {
        const { service, members, fakes, entityManager } = await build([quick(new Date("2026-01-01T07:00:00+07:00"))])
        members.require.mockResolvedValue(member)
        const topic = `${"a".repeat(90)}\nFull brief`
        await expect(
            service.createQuickIdea("user-1", "workspace-1", { topic, channels: ["facebook", "zalo"] }),
        ).resolves.toEqual({ id: "idea-1", updatedAt: "2026-01-01T00:00:00.000Z" })
        expect(members.require).toHaveBeenCalledWith("user-1", "workspace-1", ["owner", "manager"])
        expect(entityManager.createQueryBuilder).toHaveBeenCalledWith(ContentItemEntity, "ci")
        expect(fakes[0]?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "workspace-1",
                    title: "a".repeat(80),
                    brief: topic,
                    channels: ["facebook", "zalo"],
                    status: "idea",
                    source: "quick",
                    createdBy: "Mai",
                },
            ],
        ])
        expect(fakes[0]?.callsOf("returning")).toEqual([["id, updated_at"]])
    })

    it("uses the supplied transaction and falls back to the user identity for an unnamed member", async () => {
        const { service, entityManager, members } = await build()
        const tx = mockEntityManager()
        const [write] = queueQueryBuilders(tx, [quick("2026-01-02T00:00:00Z")])
        members.require.mockResolvedValue({ ...member, displayName: "" })
        await expect(
            service.createQuickIdea("user-1", "workspace-1", { topic: "", channels: ["facebook"] }, tx),
        ).resolves.toEqual({ id: "idea-1", updatedAt: "2026-01-02T00:00:00.000Z" })
        expect(write?.callsOf("values")[0]?.[0]).toMatchObject({ title: "", brief: "", createdBy: "user-1" })
        expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
    })

    it.each([
        { topic: "\nFull brief", title: "" },
        { topic: "Launch\nFull brief", title: "Launch" },
        { topic: "Launch", title: "Launch" },
    ])("preserves the first line of $topic as the title", async ({ topic, title }) => {
        const { service, members, fakes } = await build([quick("2026-01-01T00:00:00Z")])
        members.require.mockResolvedValue(member)

        await expect(service.createQuickIdea("user-1", "workspace-1", { topic, channels: [] })).resolves.toEqual({
            id: "idea-1",
            updatedAt: "2026-01-01T00:00:00.000Z",
        })
        expect(fakes[0]?.callsOf("values")[0]?.[0]).toMatchObject({ title, brief: topic, channels: [] })
    })

    it.each([[[]], [[{ id: "idea-1", updated_at: 5 }]]])(
        "refuses a quick idea insert that returns no usable row (%j)",
        async (raw) => {
            const { service, members } = await build([{ execute: { raw } }])
            members.require.mockResolvedValue(member)
            await expect(
                service.createQuickIdea("user-1", "workspace-1", { topic: "Launch", channels: ["facebook"] }),
            ).rejects.toMatchObject({ code: ContentItemsErrorCode.NotWritten })
        },
    )
})

describe("ContentAiStoreService createQuickIdea", () => {
    it("uses the bounded topic when splitting supplies no first line", async () => {
        const { service, members, fakes } = await build([quick("2026-01-03T00:00:00Z")])
        members.require.mockResolvedValue(member)
        const topic = `Fallback ${"b".repeat(90)}`
        const originalSplit = String.prototype.split
        const split = jest.spyOn(String.prototype, "split").mockImplementation(function (
            this: string,
            separator,
            limit,
        ) {
            const requestedSeparator: unknown = separator
            if (this === topic && requestedSeparator === "\n") return []
            return originalSplit.call(this, separator, limit)
        })
        try {
            await expect(service.createQuickIdea("user-1", "workspace-1", { topic, channels: [] })).resolves.toEqual({
                id: "idea-1",
                updatedAt: "2026-01-03T00:00:00.000Z",
            })
            expect(fakes[0]?.callsOf("values")[0]?.[0]).toMatchObject({
                title: `Fallback ${"b".repeat(71)}`,
                brief: topic,
            })
        } finally {
            split.mockRestore()
        }
    })
})

describe("ContentAiStoreService applyDraft", () => {
    it("applies a minimal draft using null optional values and empty evidence", async () => {
        const { service, fakes } = await build([{ execute: { raw: [{ id: "idea-1" }] } }])
        await expect(service.applyDraft("workspace-1", "idea-1", { variants, hashtags: ["launch"] })).resolves.toEqual({
            id: "idea-1",
        })
        expect(fakes[0]?.callsOf("setParameters")).toEqual([
            [
                {
                    variants: JSON.stringify(variants),
                    media: null,
                    channels: null,
                    pillarId: null,
                    title: null,
                    draftedAt: null,
                    evidence: "[]",
                    expected: null,
                },
            ],
        ])
        expect(evaluatedValues(fakes[0]?.callsOf("set")[0]?.[0])).toMatchObject({
            hashtags: ["launch"],
            status: "draft",
        })
        expect(fakes[0]?.callsOf("where")[0]?.[1]).toEqual({ itemId: "idea-1", workspaceId: "workspace-1" })
    })

    it("serializes a complete draft into the supplied transaction", async () => {
        const { service, entityManager, pillars } = await build()
        const tx = mockEntityManager()
        const [write] = queueQueryBuilders(tx, [{ execute: { raw: [{ id: "idea-1" }] } }])
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
        expect(write?.callsOf("setParameters")).toEqual([
            [
                {
                    variants: JSON.stringify(variants),
                    media: JSON.stringify(media),
                    channels: ["facebook"],
                    pillarId: "pillar-1",
                    title: "Launch",
                    draftedAt: "2026-01-01T00:00:00Z",
                    evidence: JSON.stringify(evidence),
                    expected: "2025-12-31T00:00:00Z",
                },
            ],
        ])
        expect(write?.callsOf("andWhere").map(([condition]) => condition)).toEqual([
            expect.stringContaining("date_trunc('milliseconds', updated_at)"),
        ])
        expect(pillars.exists).toHaveBeenCalledWith("workspace-1", "pillar-1", tx)
        expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("ContentAiStoreService applyDraft refusals", () => {
    it("refuses a draft that no longer has an editable row", async () => {
        const { service } = await build([{ execute: { raw: [] } }])
        await expect(service.applyDraft("workspace-1", "idea-1", { variants, hashtags: [] })).rejects.toMatchObject({
            code: ContentItemsErrorCode.NotWritten,
        })
    })

    it("refuses a draft that names a theme outside the workspace without writing", async () => {
        const { service, pillars, entityManager } = await build()
        pillars.exists.mockResolvedValue(false)
        await expect(
            service.applyDraft("workspace-1", "idea-1", { variants, hashtags: [], pillarId: "ghost" }),
        ).rejects.toMatchObject({ code: ContentItemsErrorCode.NotWritten })
        expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("ContentAiStoreService recentTitles", () => {
    it("returns only the recent titles in database order", async () => {
        const entityManager = mockEntityManager({
            find: [
                ContentItemEntity,
                [
                    Object.assign(new ContentItemEntity(), { title: "Latest" }),
                    Object.assign(new ContentItemEntity(), { title: "Earlier" }),
                ],
            ],
        })
        const { service } = await build([], entityManager)
        await expect(service.recentTitles("workspace-1", "idea-1")).resolves.toEqual(["Latest", "Earlier"])
        expect(evaluatedCalls(entityManager.find.mock.calls)).toEqual([
            [
                "ContentItemEntity",
                {
                    where: { workspaceId: "workspace-1", id: Not("idea-1") },
                    select: { title: true },
                    order: { createdAt: "DESC" },
                    take: 8,
                },
            ],
        ])
    })
})

describe("ContentAiStoreService insertPlannedIdeas", () => {
    const item = {
        title: "Launch",
        brief: "Explain launch",
        pillarId: "pillar-1",
        channels: ["facebook"],
        scheduledAt: "2026-01-02T00:00:00Z",
        holidayKey: null,
    }
    const plan = (items: ReadonlyArray<typeof item>) => ({
        month: "2026-01",
        actor: "Mai",
        meta: {},
        generationId: "generation-1",
        aiMs: 50,
        items,
    })

    it("replaces untouched ideas and serializes planned ideas and clock evidence", async () => {
        const { service, entityManager, pillars } = await build()
        pillars.known.mockResolvedValue(["pillar-1"])
        const tx = mockEntityManager()
        const [remove, insert] = queueQueryBuilders(tx, [{ execute: {} }, { execute: { raw: [{ id: "idea-1" }] } }])
        await expect(service.insertPlannedIdeas("workspace-1", "plan-1", plan([item]), tx)).resolves.toBe(1)
        expect(remove?.callsOf("where")).toEqual([[{ workspaceId: "workspace-1", status: "idea", source: "plan" }]])
        expect(remove?.callsOf("andWhere")[0]?.[1]).toEqual({ month: "2026-01-01" })
        expect(pillars.known).toHaveBeenCalledWith("workspace-1", ["pillar-1"], tx)
        expect(insert?.callsOf("values")).toEqual([
            [
                [
                    {
                        workspaceId: "workspace-1",
                        planId: "plan-1",
                        title: "Launch",
                        brief: "Explain launch",
                        pillarId: "pillar-1",
                        channels: ["facebook"],
                        scheduledAt: new Date("2026-01-02T00:00:00Z"),
                        holidayKey: null,
                        status: "idea",
                        source: "plan",
                        createdBy: "Mai",
                        evidence: [{ at: "2026-01-01T00:00:00.000Z", kind: "planned", by: "NIVO", text: "2026-01" }],
                    },
                ],
            ],
        ])
        expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a plan when the inserted count does not match its items", async () => {
        const { service } = await build()
        const tx = mockEntityManager()
        const [, insert] = queueQueryBuilders(tx, [{ execute: {} }, { execute: { raw: [] } }])
        await expect(service.insertPlannedIdeas("workspace-1", "plan-1", plan([item]), tx)).rejects.toMatchObject({
            code: ContentItemsErrorCode.NotWritten,
        })
        expect(insert?.callsOf("execute")).toEqual([])
    })

    it("writes nothing and answers zero for a plan without items", async () => {
        const { service } = await build()
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ execute: {} }])
        await expect(service.insertPlannedIdeas("workspace-1", "plan-1", plan([]), tx)).resolves.toBe(0)
        expect(tx.createQueryBuilder).toHaveBeenCalledTimes(1)
    })
})
