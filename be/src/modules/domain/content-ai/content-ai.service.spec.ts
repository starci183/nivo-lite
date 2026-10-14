import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { GenerationsService } from "@modules/domain/ai-generations"
import type { GenerationEnqueued, GenerationState } from "@modules/domain/ai-generations"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { ContentAiStoreService, ContentEditorService } from "@modules/domain/content-items"
import type { ContentItem } from "@modules/domain/content-items"
import { ContentMediaService } from "@modules/domain/content-media"
import { ContentConfigurationService } from "@modules/domain/content-settings"
import type { ContentConfiguration } from "@modules/domain/content-settings"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentAiCompletionService } from "./content-ai-completion.service"
import type { BrandMaterial } from "./content-ai-prompt.policy"
import { ContentAiService } from "./content-ai.service"
import type { ContentAiStatus } from "./content-ai.contracts"
import { ContentBrandService } from "./content-brand.service"
import { ContentAiErrorCode } from "./errors/content-ai.error"
const errorOf = (code: ContentAiErrorCode) => ({ code })
const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
}
const MATERIAL: BrandMaterial = {
    shop: "Lan",
    authority: { brandVoice: "warm", replyStyle: "short", limitsNote: "" },
    setup: { summary: "Cafe", facts: [], tone: "", claimsLimits: "", audience: "", channels: "" },
    sources: [],
    brainFacts: [],
}
const PILLAR = {
    id: "pillar-1",
    workspaceId: "ws-1",
    name: "Coffee",
    description: "Beans",
    weight: 1,
    active: true,
    sort: 0,
}
const CADENCE = {
    id: "cadence-1",
    workspaceId: "ws-1",
    channel: "facebook" as const,
    postsPerWeek: 7,
    days: [1, 2, 3, 4, 5, 6, 7],
    time: "09:00",
}
const CONFIGURATION: ContentConfiguration = {
    pillars: [PILLAR],
    cadence: [CADENCE],
    settings: {
        workspaceId: "ws-1",
        brandVoice: "",
        avoid: "",
        cta: "Book",
        hashtags: [],
        automations: { today_reminder: false, offer_draft: false, weekly_summary: false },
        marks: {},
    },
}
const itemOf = builder<ContentItem>({
    id: "item-1",
    workspaceId: "ws-1",
    planId: null,
    title: "Coffee",
    brief: "Fresh beans",
    pillarId: null,
    channels: ["facebook"],
    scheduledAt: null,
    status: "idea",
    variants: {},
    hashtags: [],
    media: [],
    links: [],
    holidayKey: null,
    evidence: [],
    published: {},
    workItemId: null,
    draftedAt: null,
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
    source: "plan",
    createdBy: "An",
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
})
const stateOf = builder<GenerationState>({
    id: "g-1",
    workspaceId: "ws-1",
    purpose: "content_draft",
    status: "queued",
    text: null,
    errorCode: null,
    input: { context: { rootId: "g-1", generationIds: ["g-2", "g-3"], itemId: "item-1" } },
    output: {},
    timings: {},
    createdAt: "2026-10-12T00:00:00.000Z",
    finishedAt: null,
    messages: [],
})
const statusOf = builder<ContentAiStatus>({
    id: "g-1",
    status: "queued",
    progress: 0,
    itemId: "item-1",
    planId: null,
    resultId: null,
    ideas: null,
    seconds: null,
    skippedPast: null,
    warnings: [],
    errorCode: null,
})
const build = async (root: GenerationState | null = null, children: ReadonlyArray<GenerationState> = []) => {
    const em = mockEntityManager()
    const tx = fakeTransaction(em)
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const brand = mock<ContentBrandService>()
    brand.material.mockResolvedValue(MATERIAL)
    const generations = mock<GenerationsService>()
    const byId = new Map(children.map((state) => [state.id, state]))
    generations.state.mockImplementation((_workspace, id) =>
        Promise.resolve(id === "g-1" ? root : (byId.get(id) ?? null)),
    )
    generations.request.mockResolvedValue({ id: "g-1", status: "queued" })
    const completion = mock<ContentAiCompletionService>()
    completion.complete.mockResolvedValue()
    const rules = mock<AuthorityRulesService>()
    rules.ruleFor.mockResolvedValue(null)
    const editor = mock<ContentEditorService>()
    editor.get.mockResolvedValue(itemOf())
    editor.list.mockResolvedValue([])
    const store = mock<ContentAiStoreService>()
    store.recentTitles.mockResolvedValue(["Yesterday's coffee"])
    store.createQuickIdea.mockResolvedValue({ id: "quick-1", updatedAt: "2026-10-12T10:00:00.000Z" })
    const configuration = mock<ContentConfigurationService>()
    configuration.readAuthorizedConfiguration.mockResolvedValue(CONFIGURATION)
    const media = mock<ContentMediaService>()
    media.library.mockResolvedValue([{ kind: "media", name: "beans.jpg", path: "ws-1/beans.jpg" }])
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentAiService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: GenerationsService, useValue: generations },
            { provide: ContentAiCompletionService, useValue: completion },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: ContentEditorService, useValue: editor },
            { provide: ContentAiStoreService, useValue: store },
            { provide: ContentConfigurationService, useValue: configuration },
            { provide: ContentMediaService, useValue: media },
            { provide: ContentBrandService, useValue: brand },
        ],
    }).compile()
    const dependencies = { brand, members, generations, completion, rules, editor, store, configuration, media }
    return { service: moduleRef.get(ContentAiService), ...dependencies, tx }
}
describe("ContentAiService", () => {
    it("returns the public brand material after proving membership", async () => {
        const { service, brand } = await build()
        await expect(service.brandFor("user-1", "ws-1")).resolves.toEqual(MATERIAL)
        expect(brand.material).toHaveBeenCalledWith("ws-1")
    })
    it("authorizes rule and recent-title reads and delegates completion", async () => {
        const { service, members, rules, store, completion } = await build()
        await expect(service.draftingBlockedFor("user-1", "ws-1")).resolves.toBe(false)
        await expect(service.recentTitlesFor("user-1", "ws-1", "item-1")).resolves.toEqual(["Yesterday's coffee"])
        await expect(service.complete("ws-1", "g-1")).resolves.toBeUndefined()
        expect(members.require.mock.calls).toEqual([
            ["user-1", "ws-1"],
            ["user-1", "ws-1"],
        ])
        expect(rules.ruleFor).toHaveBeenCalledWith({ workspaceId: "ws-1" }, "draft_post", null)
        expect(store.recentTitles).toHaveBeenCalledWith("ws-1", "item-1")
        expect(completion.complete).toHaveBeenCalledWith("ws-1", "g-1")
    })
    it("rejects drafting when the owner disables it", async () => {
        const { service, rules, editor, generations } = await build()
        rules.ruleFor.mockResolvedValue({
            id: "rule-1",
            department: "content",
            action: "draft_post",
            mode: "never",
            limit_vnd: null,
            required_fields: [],
        })
        await expect(service.draftingBlockedFor("user-1", "ws-1")).resolves.toBe(true)
        await expect(service.requestDraft("user-1", "ws-1", { id: "item-1" })).rejects.toMatchObject(
            errorOf(ContentAiErrorCode.DraftingBlocked),
        )
        expect(editor.get).not.toHaveBeenCalled()
        expect(generations.request).not.toHaveBeenCalled()
    })
    it("rejects an uneditable post and a post with no supported channels", async () => {
        const { service, editor, generations } = await build()
        editor.get.mockResolvedValueOnce(itemOf({ status: "approved" })).mockResolvedValueOnce(itemOf({ channels: [] }))
        await expect(service.requestDraft("user-1", "ws-1", { id: "item-1" })).rejects.toMatchObject(
            errorOf(ContentAiErrorCode.InvalidInput),
        )
        await expect(service.requestDraft("user-1", "ws-1", { id: "item-1", hint: "shorter" })).rejects.toMatchObject(
            errorOf(ContentAiErrorCode.InvalidInput),
        )
        expect(generations.request).not.toHaveBeenCalled()
    })
    it("enqueues a rewrite with the matched theme, holiday, library and optimistic timestamp", async () => {
        const { service, editor, members, generations, media, tx } = await build()
        editor.get.mockResolvedValue(
            itemOf({
                status: "draft",
                pillarId: "pillar-1",
                scheduledAt: "2026-10-20T02:00:00.000Z",
                holidayKey: "vn_women_day",
            }),
        )
        const request = await service.requestDraft("user-1", "ws-1", { id: "item-1", hint: "  Shorter  " })
        expect(request).toEqual({ id: "g-1", status: "queued", itemId: "item-1" })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(media.library).toHaveBeenCalledWith("user-1", "ws-1", 40)
        expect(generations.request.mock.calls[0]?.[0]).toMatchObject({
            workspaceId: "ws-1",
            purpose: "content_draft",
            module: "content",
            kind: "engine",
            responseFormat: "json",
            timeoutMs: 90000,
        })
        const messages = generations.request.mock.calls[0]?.[0].messages
        for (const text of ["Shorter", "Coffee", "beans.jpg", "Vietnamese Women's Day 20/10"])
            expect(messages?.[1]?.content).toContain(text)
        expect(generations.setContext.mock.calls[0]?.slice(0, 3)).toEqual([
            "ws-1",
            "g-1",
            expect.objectContaining({
                itemId: "item-1",
                actor: "An",
                rootId: "g-1",
                generationIds: ["g-1"],
                expectedUpdatedAt: "2026-10-12T00:00:00.000Z",
            }),
        ])
        expect(tx.commits).toBe(1)
    })
    it("enqueues a first draft without a hint and omits inactive themes from its prompt", async () => {
        const { service, configuration, generations } = await build()
        configuration.readAuthorizedConfiguration.mockResolvedValue({
            ...CONFIGURATION,
            pillars: [PILLAR, { ...PILLAR, id: "inactive", name: "Hidden theme", active: false }],
        })
        const request = await service.requestDraft("user-1", "ws-1", { id: "item-1" })
        expect(request).toEqual({ id: "g-1", status: "queued", itemId: "item-1" })
        expect(generations.request.mock.calls[0]?.[0].messages?.[1]?.content).toContain("Choose one theme: Coffee")
        expect(generations.request.mock.calls[0]?.[0].messages?.[1]?.content).not.toContain("Hidden theme")
        expect(generations.request.mock.calls[0]?.[0].messages?.[1]?.content).not.toContain("Owner hint:")
    })
    it.each([
        { topic: " \n ", channels: ["facebook"] },
        { topic: "ab", channels: ["facebook"] },
        { topic: "x".repeat(12001), channels: ["facebook"] },
        { topic: "Coffee", channels: ["myspace"] },
    ])("rejects invalid quick-draft input %#", async (input) => {
        const { service, generations, store } = await build()
        await expect(service.requestQuickDraft("user-1", "ws-1", input)).rejects.toMatchObject(
            errorOf(ContentAiErrorCode.InvalidInput),
        )
        expect(store.createQuickIdea).not.toHaveBeenCalled()
        expect(generations.request).not.toHaveBeenCalled()
    })
    it.each([
        { topic: "  Coffee\nFresh beans  ", normalized: "Coffee\nFresh beans", title: "Coffee" },
        { topic: "\n Coffee \n", normalized: "Coffee", title: "Coffee" },
        { topic: `${"x".repeat(81)}\nDetails`, normalized: `${"x".repeat(81)}\nDetails`, title: "x".repeat(80) },
        { topic: "Coffee\nDetails", normalized: "Coffee\nDetails", title: "Coffee\nDetails", missingFirstLine: true },
    ])("creates and enqueues a quick idea with normalized channels, title and row timestamp %#", async (entry) => {
        const { service, generations, store, tx } = await build()
        const split = jest.spyOn(String.prototype, "split")
        if ("missingFirstLine" in entry) split.mockReturnValueOnce([])
        try {
            await expect(
                service.requestQuickDraft("user-1", "ws-1", {
                    topic: entry.topic,
                    channels: ["facebook", "facebook", "myspace", "zalo"],
                }),
            ).resolves.toEqual({ id: "g-1", status: "queued", itemId: "quick-1" })
        } finally {
            split.mockRestore()
        }
        expect(store.createQuickIdea.mock.calls[0]?.slice(0, 3)).toEqual([
            "user-1",
            "ws-1",
            { topic: entry.normalized, channels: ["facebook", "zalo"] },
        ])
        const prompt = generations.request.mock.calls[0]?.[0].messages?.[1]?.content
        expect(prompt?.split("\n\n")[0]).toBe(`Idea: ${entry.title}`)
        expect(generations.request.mock.calls[0]?.[1]).toMatchObject({
            itemId: "quick-1",
            source: "quick",
            actor: "An",
            expectedUpdatedAt: "2026-10-12T10:00:00.000Z",
            channels: ["facebook", "zalo"],
        })
        expect(generations.setContext.mock.calls[0]?.[2]).toMatchObject({
            rootId: "g-1",
            generationIds: ["g-1"],
            itemId: "quick-1",
        })
        expect(tx.commits).toBe(1)
    })
    it.each([
        { month: "bad", configuration: CONFIGURATION, code: ContentAiErrorCode.InvalidInput },
        {
            month: "2026-11",
            configuration: {
                ...CONFIGURATION,
                pillars: [
                    { ...PILLAR, active: false },
                    { ...PILLAR, weight: 0 },
                ],
            },
            code: ContentAiErrorCode.NoPillars,
        },
        {
            month: "2026-11",
            configuration: { ...CONFIGURATION, cadence: [{ ...CADENCE, postsPerWeek: 0 }] },
            code: ContentAiErrorCode.NoCadence,
        },
        { month: "2026-09", configuration: CONFIGURATION, code: ContentAiErrorCode.NoSlots },
    ])("rejects a monthly plan that cannot be scheduled: $code", async (entry) => {
        const { service, configuration, generations } = await build()
        configuration.readAuthorizedConfiguration.mockResolvedValue(entry.configuration)
        await expect(service.requestMonthPlan("user-1", "ws-1", entry.month)).rejects.toMatchObject(errorOf(entry.code))
        expect(generations.request).not.toHaveBeenCalled()
    })
    it("rolls back a plan when the first generation response omits its id", async () => {
        const { service, generations, tx } = await build()
        generations.request.mockResolvedValueOnce(mock<GenerationEnqueued>({ id: undefined, status: "queued" }))
        await expect(service.requestMonthPlan("user-1", "ws-1", "2026-11")).rejects.toMatchObject({
            code: "CONTENT_AI_NO_SLOTS",
            message: "CONTENT_AI_NO_SLOTS",
            params: {},
        })
        expect(generations.setContext).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual(["rollback"])
    })
    it("enqueues successive twelve-slot chunks and stores the complete root context", async () => {
        const { service, editor, generations, tx } = await build()
        editor.list.mockResolvedValue([
            itemOf({ title: "Old plan idea" }),
            itemOf({ source: "quick", title: "Saved quick idea" }),
            itemOf({ status: "draft", title: "Saved draft" }),
        ])
        generations.request
            .mockResolvedValueOnce({ id: "g-1", status: "queued" })
            .mockResolvedValueOnce({ id: "g-2", status: "queued" })
            .mockResolvedValueOnce({ id: "g-3", status: "queued" })
        const request = await service.requestMonthPlan("user-1", "ws-1", "2026-11")
        expect(request).toEqual({ id: "g-1", status: "queued", itemId: null })
        expect(editor.list).toHaveBeenCalledWith("user-1", "ws-1", {
            from: "2026-10-31T17:00:00.000Z",
            to: "2026-11-30T17:00:00.000Z",
        })
        expect(generations.request).toHaveBeenCalledTimes(3)
        expect(generations.request.mock.calls.map((call) => call[1])).toEqual([
            { operation: "plan", rootId: undefined, attempt: 1, allowedSlots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
            {
                operation: "plan",
                rootId: "g-1",
                attempt: 1,
                allowedSlots: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
            },
            { operation: "plan", rootId: "g-1", attempt: 1, allowedSlots: [25, 26, 27, 28, 29, 30] },
        ])
        const messages = generations.request.mock.calls[0]?.[0].messages
        expect(messages?.[1]?.content).toContain("Saved quick idea")
        expect(messages?.[1]?.content).toContain("Saved draft")
        expect(messages?.[1]?.content).not.toContain("Old plan idea")
        expect(generations.setContext.mock.calls[0]?.[2]).toMatchObject({
            operation: "plan",
            rootId: "g-1",
            generationIds: ["g-1", "g-2", "g-3"],
            actor: "An",
            month: "2026-11",
            quota: [{ pillar: "Coffee", count: 30 }],
            skippedPast: 0,
            allowedSlots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        })
        expect(tx.commits).toBe(1)
    })
})
describe("ContentAiService status", () => {
    it.each([null, stateOf({ purpose: "chat_reply" }), stateOf({ input: { context: { rootId: "g-other" } } })])(
        "hides missing, unrelated and child generations %#",
        async (root) => {
            const { service, generations } = await build(root)
            await expect(service.status("user-1", "ws-1", "g-1")).rejects.toMatchObject(
                errorOf(ContentAiErrorCode.NotFound),
            )
            expect(generations.state).toHaveBeenCalledTimes(1)
        },
    )
    it("reports an entirely queued operation without running completion", async () => {
        const { service, members, completion } = await build(stateOf(), [
            stateOf({ id: "g-2" }),
            stateOf({ id: "g-3" }),
        ])
        await expect(service.status("user-1", "ws-1", "g-1")).resolves.toEqual(statusOf())
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(completion.complete).not.toHaveBeenCalled()
    })
    it.each([
        { root: stateOf(), children: [stateOf({ id: "g-2", status: "done" }), stateOf({ id: "g-3" })], progress: 48 },
        {
            root: stateOf({ status: "running" }),
            children: [stateOf({ id: "g-2", status: "done" }), stateOf({ id: "g-3", status: "done" })],
            progress: 95,
        },
        { root: stateOf(), children: [], progress: 0 },
    ])("reports running progress for active or missing children %#", async ({ root, children, progress }) => {
        const { service } = await build(root, children)
        await expect(service.status("user-1", "ws-1", "g-1")).resolves.toMatchObject({
            status: "running",
            progress,
            errorCode: null,
        })
    })
    it.each([
        { status: "error" as const, errorCode: "CUSTOM_FAILURE", expected: "CUSTOM_FAILURE" },
        { status: "cancelled" as const, errorCode: null, expected: ContentAiErrorCode.Failed },
        { status: "error" as const, errorCode: "private provider detail", expected: ContentAiErrorCode.Failed },
    ])("normalizes failed operation errors %#", async ({ status, errorCode, expected }) => {
        const { service } = await build(stateOf({ status, errorCode, input: { context: { rootId: "g-1" } } }))
        await expect(service.status("user-1", "ws-1", "g-1")).resolves.toMatchObject({
            status: "failed",
            progress: 0,
            itemId: null,
            resultId: null,
            errorCode: expected,
        })
    })
    it("returns the applied draft result and normalized review warnings", async () => {
        const { service } = await build(
            stateOf({
                output: {
                    result: {
                        itemId: "draft-1",
                        ideas: 2,
                        seconds: 3,
                        skippedPast: 4,
                        warnings: [
                            { channel: "facebook", warning: { kind: "promise", phrase: "100%" } },
                            { channel: "myspace" },
                        ],
                    },
                },
            }),
        )
        await expect(service.status("user-1", "ws-1", "g-1")).resolves.toEqual(
            statusOf({
                status: "succeeded",
                progress: 100,
                itemId: "draft-1",
                resultId: "draft-1",
                ideas: 2,
                seconds: 3,
                skippedPast: 4,
                warnings: [
                    {
                        channel: "facebook",
                        warning: { kind: "promise", phrase: "100%", figure: null, length: null, max: null },
                    },
                ],
            }),
        )
    })
    it("returns a saved plan identifier with no related item", async () => {
        const { service } = await build(
            stateOf({
                purpose: "content_plan",
                input: { context: { rootId: "g-1" } },
                output: { result: { planId: "plan-1" } },
            }),
        )
        await expect(service.status("user-1", "ws-1", "g-1")).resolves.toMatchObject({
            status: "succeeded",
            itemId: null,
            planId: "plan-1",
            resultId: "plan-1",
            warnings: [],
        })
    })
})
