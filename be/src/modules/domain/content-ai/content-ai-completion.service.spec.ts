import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { GenerationsService } from "@modules/domain/ai-generations"
import type { GenerationState } from "@modules/domain/ai-generations"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { ContentAiStoreService, ContentEditorService } from "@modules/domain/content-items"
import type { ContentItem } from "@modules/domain/content-items"
import { ContentPlansService } from "@modules/domain/content-plans"
import { EvidenceService } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ContentAiCompletionService } from "./content-ai-completion.service"
import { ContentAiLogEvent } from "./content-ai.log-events"
import { ContentAiErrorCode } from "./errors/content-ai.error"

const NOW = "2026-10-13T03:00:30.000Z"

const stateOf = builder<GenerationState>({
    id: "g-2",
    workspaceId: "ws-1",
    purpose: "content_plan",
    status: "done",
    text: null,
    errorCode: null,
    input: { context: { rootId: "g-1" } },
    output: {},
    timings: {},
    createdAt: "2026-10-13T03:00:00.000Z",
    finishedAt: null,
    messages: [{ role: "user", content: "Write a post" }],
})

const BRAND = {
    shop: "Flower Shop",
    knowledge: "Fresh flowers delivered the same day.",
    voice: "friendly",
    avoid: "",
    audience: "Office customers",
    cta: "Message the shop",
    sources: [],
    brandHashtags: ["#tiemhoa"],
}

const PILLAR = { id: "pl-1", name: "Products", description: "", weight: 1, active: true }

const itemOf = builder<ContentItem>({
    id: "item-1",
    workspaceId: "ws-1",
    planId: null,
    title: "Roses this week",
    brief: "",
    pillarId: "pl-1",
    channels: ["zalo"],
    scheduledAt: null,
    status: "idea",
    variants: {},
    hashtags: [],
    media: [{ kind: "image", name: "old.jpg", suggested: true }],
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
    createdBy: "Lan",
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
})

const build = async (states: ReadonlyArray<GenerationState>) => {
    const em = mockEntityManager()
    const tx = fakeTransaction(em)
    const clock = new FakeClock(NOW)
    const logger = mock<Logger>()
    const byId = new Map(states.map((state) => [state.id, state]))
    const generations = mock<GenerationsService>({
        state: jest.fn((_workspaceId: string, id: string) => Promise.resolve(byId.get(id) ?? null)),
        recordResult: jest.fn(() => Promise.resolve()),
        recordFailure: jest.fn(() => Promise.resolve()),
        setContext: jest.fn(() => Promise.resolve()),
        request: jest.fn(() => Promise.resolve({ id: "g-3", status: "queued" as const })),
    })
    const rules = mock<AuthorityRulesService>({ ruleFor: jest.fn(() => Promise.resolve(null)) })
    const editor = mock<ContentEditorService>({ get: jest.fn(() => Promise.resolve(itemOf())) })
    const store = mock<ContentAiStoreService>({ applyDraft: jest.fn(() => Promise.resolve({ id: "item-1" })) })
    const plans = mock<ContentPlansService>({ apply: jest.fn(() => Promise.resolve({ planId: "p-1", ideas: 1 })) })
    const evidence = mock<EvidenceService>({ decide: jest.fn(() => Promise.resolve()) })
    const events = mock<EventsService>({ record: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentAiCompletionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
            { provide: GenerationsService, useValue: generations },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: ContentEditorService, useValue: editor },
            { provide: ContentAiStoreService, useValue: store },
            { provide: ContentPlansService, useValue: plans },
            { provide: EvidenceService, useValue: evidence },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    const service = moduleRef.get(ContentAiCompletionService)
    return { service, tx, logger, generations, rules, editor, store, plans, evidence, events }
}

/** The arguments of a call without its trailing transaction manager. */
const withoutManager = (calls: ReadonlyArray<ReadonlyArray<unknown>>): Array<Array<unknown>> =>
    calls.map((call) => call.slice(0, -1))

const PLAN_CONTEXT = {
    operation: "plan",
    generationIds: ["g-2"],
    month: "2026-11",
    actor: "Lan",
    quota: [],
    holidays: [],
    sources: ["Price list"],
    skippedPast: 2,
    slots: [
        { n: 1, at: "2026-11-02T02:00:00.000Z", channels: ["facebook"], pillar: PILLAR, holiday: null },
        { n: 2, at: "2026-11-05T02:00:00.000Z", channels: ["zalo"], pillar: PILLAR, holiday: null },
    ],
}

const planRoot = stateOf({ id: "g-1", status: "running", input: { context: PLAN_CONTEXT } })

const DRAFT_CONTEXT = {
    operation: "draft",
    generationIds: ["g-2"],
    itemId: "item-1",
    channels: ["facebook", "myspace"],
    brand: BRAND,
    library: [{ kind: "image", name: "hoa-hong.jpg", path: "ws-1/hoa-hong.jpg" }],
    pillars: [],
    expectedUpdatedAt: "2026-10-12T00:00:00.000Z",
}
const draftRoot = stateOf({ id: "g-1", purpose: "content_draft", status: "running", input: { context: DRAFT_CONTEXT } })

const draftChild = stateOf({
    purpose: "content_draft",
    text: JSON.stringify({
        variants: { facebook: { text: "Fresh roses every morning.", hashtags: ["#hoahong"], note: "" } },
        media: [1, 7],
        hashtags: ["hoa hong"],
    }),
})

describe("ContentAiCompletionService", () => {
    it("ignores a generation that is not a content generation", async () => {
        const { service, tx, generations } = await build([stateOf({ purpose: "chat_reply" })])
        await service.complete("ws-1", "g-2")
        expect(tx.outcomes).toEqual([])
        expect(generations.recordResult).not.toHaveBeenCalled()
    })

    it("applies the accepted ideas of a finished plan with the timing and records the result", async () => {
        const child = stateOf({
            input: { context: { rootId: "g-1", allowedSlots: [1, 2] } },
            text: JSON.stringify({
                ideas: [
                    { slot: 1, title: "Flowers for the office", brief: "Same-day delivery" },
                    { slot: 1, title: "Same slot", brief: "" },
                    { slot: 9, title: "Outside the slots", brief: "" },
                ],
            }),
        })
        const { service, tx, generations, plans, events } = await build([planRoot, child])
        await service.complete("ws-1", "g-2")
        expect(withoutManager(plans.apply.mock.calls)).toEqual([
            [
                "ws-1",
                {
                    month: "2026-11",
                    actor: "Lan",
                    items: [
                        {
                            slot: 1,
                            title: "Flowers for the office",
                            brief: "Same-day delivery",
                            pillarId: "pl-1",
                            channels: ["facebook"],
                            scheduledAt: "2026-11-02T02:00:00.000Z",
                            holidayKey: null,
                        },
                    ],
                    generationId: "g-2",
                    aiMs: 30000,
                    meta: { slots: 2, quota: [], holidays: [], sources: ["Price list"] },
                },
            ],
        ])
        expect(withoutManager(events.record.mock.calls)).toEqual([
            [{ workspaceId: "ws-1", kind: "content.planned", actor: "Lan", summary: "2026-11", evidence: "1: g-1" }],
        ])
        expect(withoutManager(generations.recordResult.mock.calls)).toEqual([
            ["ws-1", "g-1", { planId: "p-1", ideas: 1, seconds: 30, skippedPast: 2 }],
        ])
        expect(tx.commits).toBe(1)
    })

    it("writes the draft variants, suggested media, evidence and event for a finished draft", async () => {
        const { service, generations, store, evidence, events } = await build([draftRoot, draftChild])
        await service.complete("ws-1", "g-2")
        expect(withoutManager(store.applyDraft.mock.calls)).toEqual([
            [
                "ws-1",
                "item-1",
                {
                    variants: { facebook: { text: "Fresh roses every morning.", hashtags: ["#hoahong"], note: "" } },
                    hashtags: ["#hoahong"],
                    media: [{ kind: "image", name: "hoa-hong.jpg", path: "ws-1/hoa-hong.jpg", suggested: true }],
                    channels: ["zalo", "facebook"],
                    draftedAt: NOW,
                    expectedUpdatedAt: "2026-10-12T00:00:00.000Z",
                    evidence: [{ at: NOW, kind: "drafted", by: "NIVO", text: "g-1: facebook" }],
                },
            ],
        ])
        expect(evidence.decide.mock.calls[0]?.[1]).toMatchObject({
            department: "content",
            action: "draft_post",
            outcome: "auto_done",
            note: "Roses this week",
        })
        expect(events.record.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            kind: "content.drafted",
            actor: "NIVO",
            summary: "Roses this week",
            evidence: "facebook",
        })
        expect(withoutManager(generations.recordResult.mock.calls)).toEqual([
            ["ws-1", "g-1", { itemId: "item-1", seconds: 30, warnings: [] }],
        ])
    })

    it("records the refusal when the owner blocked drafting", async () => {
        const { service, tx, logger, rules, generations, store } = await build([draftRoot, draftChild])
        rules.ruleFor.mockResolvedValue({
            id: "r-1",
            department: "content",
            action: "draft_post",
            mode: "never",
            limit_vnd: null,
            required_fields: [],
        })
        await service.complete("ws-1", "g-2")
        expect(store.applyDraft).not.toHaveBeenCalled()
        expect(withoutManager(generations.recordFailure.mock.calls)).toEqual([
            ["ws-1", "g-1", ContentAiErrorCode.DraftingBlocked],
        ])
        expect(logger.error.mock.calls[0]?.[0]).toBe(ContentAiLogEvent.CompletionFailed)
        expect(logger.error.mock.calls[0]?.[2]).toEqual({ workspaceId: "ws-1", generationId: "g-2" })
        expect(tx.outcomes).toEqual(["rollback", "commit"])
    })

    it("asks once more for an unreadable answer and swaps the child in the root context", async () => {
        const unreadable = stateOf({ text: "not json", input: { context: { rootId: "g-1" }, timeout_ms: 60000 } })
        const { service, generations, plans } = await build([planRoot, unreadable])
        await service.complete("ws-1", "g-2")
        const [request, context] = generations.request.mock.calls[0] ?? []
        expect(request).toEqual({
            workspaceId: "ws-1",
            purpose: "content_plan",
            module: "content",
            kind: "engine",
            responseFormat: "json",
            messages: [{ role: "user", content: "Write a post" }],
            timeoutMs: 60000,
        })
        expect(context).toEqual({ rootId: "g-1", attempt: 2 })
        expect(generations.setContext.mock.calls[0]?.[2]).toMatchObject({ generationIds: ["g-3"], operation: "plan" })
        expect(plans.apply).not.toHaveBeenCalled()
    })

    it("leaves a root that already has its result", async () => {
        const settled = stateOf({ ...planRoot, output: { result: { planId: "p-0" } } })
        const { service, tx, generations } = await build([settled, stateOf({ text: "{}" })])

        await service.complete("ws-1", "g-2")

        expect(generations.recordResult).not.toHaveBeenCalled()
        expect(generations.recordFailure).not.toHaveBeenCalled()
        expect(tx.commits).toBe(1)
    })

    it("waits while another child of the plan is still running", async () => {
        const root = stateOf({
            ...planRoot,
            input: { context: { ...PLAN_CONTEXT, generationIds: ["g-2", "g-4"] } },
        })
        const done = stateOf({ text: JSON.stringify({ ideas: [] }) })
        const { service, generations } = await build([root, done, stateOf({ id: "g-4", status: "running" })])

        await service.complete("ws-1", "g-2")

        expect(generations.recordResult).not.toHaveBeenCalled()
        expect(generations.recordFailure).not.toHaveBeenCalled()
    })

    it.each([
        [stateOf({ status: "error" }), ContentAiErrorCode.Failed],
        [
            stateOf({ text: "still not json", input: { context: { rootId: "g-1", attempt: 2 } } }),
            ContentAiErrorCode.InvalidAnswer,
        ],
        [
            stateOf({
                input: { context: { rootId: "g-1", allowedSlots: [1] } },
                text: JSON.stringify({ ideas: [{ slot: 2, title: "Wrong slot", brief: "" }] }),
            }),
            ContentAiErrorCode.EmptyAnswer,
        ],
    ])("records the child failure or invalid answer as %s / %s", async (child, code) => {
        const { service, generations } = await build([planRoot, child])
        await service.complete("ws-1", "g-2")
        expect(generations.request).not.toHaveBeenCalled()
        expect(withoutManager(generations.recordFailure.mock.calls)).toEqual([["ws-1", "g-1", code]])
        expect(generations.recordResult).not.toHaveBeenCalled()
    })

    it.each([
        [],
        [draftChild],
        [stateOf({ ...planRoot, status: "error" }), draftChild],
        [stateOf({ ...planRoot, status: "cancelled" }), draftChild],
        [stateOf({ ...planRoot, input: { context: {} } }), draftChild],
        [planRoot, stateOf({ status: "queued" })],
        [planRoot, stateOf()],
    ])("ignores missing, terminal, unrelated and unfinished operations: %s", async (...states) => {
        const { service, generations } = await build(states)
        await service.complete("ws-1", "g-2")
        expect(generations.recordResult).not.toHaveBeenCalled()
        expect(generations.recordFailure).not.toHaveBeenCalled()
    })
    it("uses its own id when the root id is absent", async () => {
        const { service, generations } = await build([
            stateOf({ status: "queued", input: { context: { generationIds: ["g-2"] } } }),
        ])
        await service.complete("ws-1", "g-2")
        expect(generations.state.mock.calls.map((call) => call.slice(0, 2))).toEqual([
            ["ws-1", "g-2"],
            ["ws-1", "g-2"],
        ])
    })
    it.each([null, "error", "cancelled"])("records a missing or failed sibling: %s", async (status) => {
        const root = stateOf({ ...planRoot, input: { context: { ...PLAN_CONTEXT, generationIds: ["g-2", "g-4"] } } })
        const states = [root, stateOf({ text: "{}" })]
        if (status !== null) states.push(stateOf({ id: "g-4", status }))
        const { service, generations } = await build(states)
        await service.complete("ws-1", "g-2")
        expect(generations.recordFailure.mock.calls[0]?.[2]).toBe(ContentAiErrorCode.Failed)
        const cancelled = await build([planRoot, stateOf({ status: "cancelled" })])
        await cancelled.service.complete("ws-1", "g-2")
        expect(cancelled.generations.recordFailure.mock.calls[0]?.[2]).toBe(ContentAiErrorCode.Failed)
    })
    it("normalizes collaborator failures and retries unreadable output with default timeout", async () => {
        const failed = await build([draftRoot, draftChild])
        failed.store.applyDraft.mockRejectedValue({ reason: "storage failed" })
        await failed.service.complete("ws-1", "g-2")
        expect(failed.generations.recordFailure.mock.calls[0]?.[2]).toBe(ContentAiErrorCode.Failed)
        const root = stateOf({ ...planRoot, input: { context: { ...PLAN_CONTEXT, generationIds: ["g-2", "g-4"] } } })
        const retry = await build([root, stateOf({ text: "bad" })])
        await retry.service.complete("ws-1", "g-2")
        expect(retry.generations.request.mock.calls[0]?.[0].timeoutMs).toBe(120000)
        expect(retry.generations.setContext.mock.calls[0]?.[2]).toMatchObject({ generationIds: ["g-3", "g-4"] })
    })
    it("rejects a vanished finished draft and invalid draft metadata", async () => {
        const vanished = await build([])
        vanished.generations.state
            .mockResolvedValueOnce(draftChild)
            .mockResolvedValueOnce(draftRoot)
            .mockResolvedValueOnce(draftChild)
            .mockResolvedValueOnce(null)
        await vanished.service.complete("ws-1", "g-2")
        expect(vanished.generations.recordFailure.mock.calls[0]?.[2]).toBe(ContentAiErrorCode.InvalidAnswer)
        for (const change of [{ brand: null }, { channels: undefined }, { channels: [] }]) {
            const context = { ...DRAFT_CONTEXT, ...change }
            const { service, generations } = await build([stateOf({ ...draftRoot, input: { context } }), draftChild])
            await service.complete("ws-1", "g-2")
            expect(generations.recordFailure.mock.calls[0]?.[2]).toBe(
                "brand" in change ? ContentAiErrorCode.InvalidAnswer : ContentAiErrorCode.EmptyAnswer,
            )
        }
    })
    it("matches a theme, trims the quick title, validates media and retains manual attachments", async () => {
        const context = {
            ...DRAFT_CONTEXT,
            expectedUpdatedAt: undefined,
            library: [{ kind: "image", name: "rose.jpg" }],
            pillars: [{ ...PILLAR, name: "Other" }, PILLAR],
        }
        const child = stateOf({
            ...draftChild,
            text: JSON.stringify({
                variants: { facebook: { text: "Roses" } },
                media: [1, 0, 1.5, "bad", 7],
                hashtags: ["roses", 5],
                pillar: "products",
                title: "R".repeat(250),
            }),
        })
        const { service, editor, store } = await build([stateOf({ ...draftRoot, input: { context } }), child])
        editor.get.mockResolvedValue(
            itemOf({ pillarId: null, source: "quick", media: [{ kind: "image", name: "manual.jpg" }] }),
        )
        await service.complete("ws-1", "g-2")
        expect(store.applyDraft.mock.calls[0]?.[2]).toMatchObject({
            pillarId: "pl-1",
            title: "R".repeat(200),
            hashtags: ["#roses"],
            expectedUpdatedAt: undefined,
            media: [
                { kind: "image", name: "manual.jpg" },
                { kind: "image", name: "rose.jpg", suggested: true },
            ],
        })
    })
    it.each([undefined, null, []])(
        "defaults draft lists (%s) and keeps existing hashtags without a title",
        async (library) => {
            const context = { ...DRAFT_CONTEXT, library, pillars: undefined }
            const child = stateOf({
                ...draftChild,
                text: JSON.stringify({
                    variants: { facebook: { text: "Roses" } },
                    media: library === undefined ? undefined : [0, 1, 1.5, 7],
                }),
            })
            const { service, editor, store } = await build([stateOf({ ...draftRoot, input: { context } }), child])
            editor.get.mockResolvedValue(itemOf({ pillarId: null, source: "quick", hashtags: ["saved"] }))
            await service.complete("ws-1", "g-2")
            expect(store.applyDraft.mock.calls[0]?.[2]).toMatchObject({ hashtags: ["#saved"], media: [] })
            expect(store.applyDraft.mock.calls[0]?.[2]).not.toHaveProperty("title")
        },
    )
    it("uses the root id when the shared generation context becomes empty while awaiting a child", async () => {
        const context = { ...DRAFT_CONTEXT, generationIds: ["g-2"] }
        const root = stateOf({ ...draftRoot, text: draftChild.text, input: { context } })
        const { service, generations, store } = await build([root, draftChild])
        generations.state
            .mockResolvedValueOnce(draftChild)
            .mockResolvedValueOnce(root)
            .mockImplementationOnce(() => {
                context.generationIds = []
                return Promise.resolve(draftChild)
            })
        await service.complete("ws-1", "g-2")
        expect(generations.state.mock.calls.map((call) => call[1])).toEqual(["g-2", "g-1", "g-2", "g-1"])
        expect(store.applyDraft.mock.calls[0]?.[2].media).toEqual([
            { kind: "image", name: "hoa-hong.jpg", path: "ws-1/hoa-hong.jpg", suggested: true },
        ])
        expect(withoutManager(generations.recordResult.mock.calls)).toEqual([
            ["ws-1", "g-1", { itemId: "item-1", seconds: 30, warnings: [] }],
        ])
    })
    it("rejects malformed plan siblings and missing scheduling metadata", async () => {
        for (const slots of [undefined, PLAN_CONTEXT.slots]) {
            const root = stateOf({ ...planRoot, input: { context: { ...PLAN_CONTEXT, slots } } })
            const { service, generations } = await build([
                root,
                stateOf({ text: '{"ideas":[{"slot":1,"title":"Roses"}]}' }),
            ])
            await service.complete("ws-1", "g-2")
            expect(generations.recordFailure.mock.calls[0]?.[2]).toBe(ContentAiErrorCode.EmptyAnswer)
        }
        const root = stateOf({ ...planRoot, input: { context: { ...PLAN_CONTEXT, generationIds: ["g-2", "g-4"] } } })
        const { service, generations } = await build([root, stateOf({ text: "{}" }), stateOf({ id: "g-4" })])
        await service.complete("ws-1", "g-2")
        expect(generations.recordFailure.mock.calls[0]?.[2]).toBe(ContentAiErrorCode.InvalidAnswer)
    })

    it("applies a pinned holiday and defaults the skipped-past count", async () => {
        const holiday = { key: "new_year", name: "New Year", date: "2027-01-01", angle: "Wishes" }
        const slots = PLAN_CONTEXT.slots.map((slot) => ({ ...slot, holiday }))
        const root = stateOf({ ...planRoot, input: { context: { ...PLAN_CONTEXT, skippedPast: null, slots } } })
        const child = stateOf({
            text: '{"ideas":[{"slot":1,"title":"Roses"}]}',
            input: { context: { rootId: "g-1", allowedSlots: [1] } },
        })
        const { service, generations, plans } = await build([root, child])
        await service.complete("ws-1", "g-2")
        expect(plans.apply.mock.calls[0]?.[1].items[0]?.holidayKey).toBe("new_year")
        expect(generations.recordResult.mock.calls[0]?.[2]).toEqual({
            planId: "p-1",
            ideas: 1,
            seconds: 30,
            skippedPast: 0,
        })
    })
})
