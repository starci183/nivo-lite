import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL, workflowStoppedPayload } from "@nivo-lite/blocks-core"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeEffectExecutor } from "@modules/domain/graph-nodes"
import { stopCardSectionGiven } from "@modules/domain/team-chat"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { RunStop, StopCardContext } from "./run-stop.contracts"
import { StopCardsService, stopCardKeyOf, stopCardStateOf } from "./stop-cards.service"

const NOW = "2026-11-10T10:00:00.000Z"

const STOP: RunStop = {
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "match",
    agentId: "agent-1",
    workflowId: null,
    leadId: null,
    conversationId: null,
    kind: "ai_report",
    state: "open",
    reason: "Khoản 1.000đ không chỉ đơn nào",
    question: "Của đơn SO-0003?",
    detail: {
        suggestions: [{ text: "Ghi nhận cho SO-0003", handledBy: "workflow" }],
        facts: [{ name: "amount", value: "1.000đ" }],
    },
    cardMessageId: "msg-1",
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 2,
    stoppedAt: NOW,
    resolvedAt: null,
}

const CONTEXT: StopCardContext = {
    locale: "vi",
    workflow: { moduleKey: "accounting", key: "reconcile", title: "Đối soát tiền về" },
    step: { key: "match", nodeId: "accounting.match-payment", title: "Khớp tiền với đơn" },
    by: "ai",
}

const build = async (served = true) => {
    const post = mock<NodeEffectExecutor>({ effect: TOOL.teamMessagePost })
    post.execute.mockResolvedValue({ kind: "chat-message", id: "msg-1" })
    const nodes = mock<GraphNodeRegistryService>({ optionalExecutorOf: jest.fn(() => (served ? post : undefined)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            StopCardsService,
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
        ],
    }).compile()
    return { cards: moduleRef.get(StopCardsService), post }
}

/** The payload of the nth team post. */
const payloadOf = (post: { execute: jest.Mock }, nth: number): object => {
    const payload: unknown = post.execute.mock.calls[nth]?.[1]
    return typeof payload === "object" && payload !== null ? payload : {}
}

/** A member of a value read as an object. */
const memberOf = (value: unknown, name: string): unknown =>
    typeof value === "object" && value !== null ? Reflect.get(value, name) : undefined

describe("StopCardsService", () => {
    it("posts the stop's card under the step's key, typed open with the three decisions, and no raw facts in its line", async () => {
        const { cards, post } = await build()

        await expect(cards.posted("ws-1", STOP, CONTEXT, NOW)).resolves.toBe("msg-1")

        const [turn, , call] = post.execute.mock.calls[0] ?? []
        expect(turn).toMatchObject({ workspaceId: "ws-1", agentId: "agent-1", conversationId: null, locale: "vi" })
        expect(call).toEqual({ key: `${stopCardKeyOf("run-1", "match")}:2`, dedupeKey: "run-stuck:run-1:match" })
        const payload = payloadOf(post, 0)
        expect(payload).toMatchObject({
            kind: "workflow.stopped",
            title: "[teamChat.stopCard.open.ai_report]",
            summary: "Khoản 1.000đ không chỉ đơn nào\nCủa đơn SO-0003?",
        })
        const given = memberOf(payload, "card")
        expect(workflowStoppedPayload.parse(given)).toMatchObject({
            workflow: CONTEXT.workflow,
            step: CONTEXT.step,
            runId: "run-1",
            leadId: null,
            by: "ai",
            decisions: ["retry", "take_over", "skip"],
            facts: [{ name: "amount", value: "1.000đ" }],
            repeats: 2,
        })
        expect(stopCardSectionGiven.parse(memberOf(given, "stop"))).toEqual({
            version: 1,
            stopId: "stop-1",
            runId: "run-1",
            stepKey: "match",
            kind: "ai_report",
            state: "open",
            headline: "[teamChat.stopCard.open.ai_report]",
            needs: { answer: true, decisions: ["retry", "take_over", "skip"], verdicts: [] },
            replies: [],
            repeats: 2,
            stoppedAt: NOW,
            resolvedAt: null,
        })
    })

    it("asks a verdict on a permission request, and names an AI failure and an engine stop as NIVO's report", async () => {
        const { cards, post } = await build()

        await cards.posted("ws-1", { ...STOP, kind: "approval" }, CONTEXT, NOW)
        const card = memberOf(payloadOf(post, 0), "card")
        expect(stopCardSectionGiven.parse(memberOf(card, "stop"))).toMatchObject({
            kind: "approval",
            needs: { answer: false, decisions: [], verdicts: ["approve", "refuse"] },
        })
        expect(workflowStoppedPayload.parse(card).decisions).toEqual([])

        await cards.posted("ws-1", { ...STOP, kind: "ai_error" }, { ...CONTEXT, by: "engine" }, NOW)
        expect(payloadOf(post, 1)).toMatchObject({ title: "[teamChat.stopCard.open.ai_error]" })
        expect(cards.sectionOf({ ...STOP, kind: "engine" }, "vi").kind).toBe("ai_error")
    })

    it("rewrites the one card in place when the founder answers, keeping who, when and the words", async () => {
        const { cards, post } = await build()
        const answer = { kind: "answer" as const, text: "Giữ đơn mở nhé", by: "seat-1", at: NOW }

        await cards.rewritten("ws-1", { ...STOP, answers: [answer], decision: answer }, "vi")

        expect(post.execute.mock.calls[0]?.[2]).toEqual({
            key: "run-stuck:run-1:match:answered:2:1",
            dedupeKey: "run-stuck:run-1:match",
        })
        const payload = payloadOf(post, 0)
        expect(memberOf(payload, "kind")).toBe("workflow.stopped")
        const rewrite = memberOf(payload, "rewrite")
        expect(memberOf(rewrite, "title")).toBe("[teamChat.stopCard.answered]")
        expect(stopCardSectionGiven.parse(memberOf(rewrite, "stop"))).toMatchObject({
            state: "answered",
            needs: { answer: false, decisions: [], verdicts: [] },
            replies: [{ kind: "answer", text: "Giữ đơn mở nhé", by: "seat-1", at: NOW }],
        })
    })

    it("rewrites a resolved stop in place under the same key, and posts nothing for a stop that never had a card", async () => {
        const { cards, post } = await build()

        await cards.resolved("ws-1", { ...STOP, state: "resolved" }, "vi", NOW)
        const rewrite = memberOf(payloadOf(post, 0), "rewrite")
        expect(stopCardSectionGiven.parse(memberOf(rewrite, "stop"))).toMatchObject({
            state: "resolved",
            resolvedAt: NOW,
        })
        expect(post.execute.mock.calls[0]?.[2]).toMatchObject({ dedupeKey: "run-stuck:run-1:match" })

        post.execute.mockClear()
        await cards.resolved("ws-1", { ...STOP, cardMessageId: null }, "vi", NOW)
        await cards.rewritten("ws-1", { ...STOP, cardMessageId: null }, "vi")
        expect(post.execute).not.toHaveBeenCalled()
    })

    it("posts nothing where the app serves no team post", async () => {
        const { cards, post } = await build(false)
        await expect(cards.posted("ws-1", STOP, CONTEXT, NOW)).resolves.toBeNull()
        await cards.rewritten("ws-1", STOP, "vi")
        expect(post.execute).not.toHaveBeenCalled()
    })
})

describe("stopCardStateOf", () => {
    it.each([
        ["open, no decision", "open", null, "open", true],
        ["open, answered (the step runs again)", "open", "answer", "answered", false],
        ["open, retried", "open", "retry", "answered", false],
        ["open, taken over", "open", "take_over", "answered", true],
        ["open, a deadline answered", "open", "timeout", "timed_out", false],
        ["resolved by a skip", "resolved", "skip", "skipped", false],
        ["resolved after a deadline", "resolved", "timeout", "timed_out", false],
        ["resolved after an answer", "resolved", "answer", "answered", false],
        ["resolved with no decision", "resolved", null, "resolved", false],
    ] as const)("%s", (_name, state, decision, expected, asks) => {
        const read = stopCardStateOf({
            kind: "ai_report",
            state,
            decision: decision === null ? null : { kind: decision, text: null, by: "seat-1", at: NOW },
        })
        expect(read.state).toBe(expected)
        expect(read.needs.answer).toBe(asks)
    })

    it("asks for the founder's words, a retry or a skip after a take-over", () => {
        const read = stopCardStateOf({
            kind: "ai_error",
            state: "open",
            decision: { kind: "take_over", text: null, by: "seat-1", at: NOW },
        })
        expect(read.needs).toEqual({ answer: true, decisions: ["retry", "skip"], verdicts: [] })
    })
})
