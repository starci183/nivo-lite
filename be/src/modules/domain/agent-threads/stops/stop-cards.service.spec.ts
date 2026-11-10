import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL, workflowStoppedPayload } from "@nivo-lite/blocks-core"
import { GraphNodeRegistryService, type NodeEffectExecutor } from "@modules/domain/graph-nodes"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
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
    reason: "A credit of 1,000 names no order",
    question: "Is it for SO-0003?",
    detail: {
        suggestions: [{ text: "Book it to SO-0003", handledBy: "workflow" }],
        facts: [{ name: "amount", value: "1,000" }],
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
    workflow: { moduleKey: "accounting", key: "reconcile", title: "Reconcile" },
    step: { key: "match", nodeId: "accounting.match-payment", title: "Match the credit" },
    by: "ai",
}

const NOTHING = { answer: false, decisions: [], verdicts: [] }

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
    const payloadOf = (nth: number): unknown => post.execute.mock.calls[nth]?.[1]
    return { cards: moduleRef.get(StopCardsService), post, payloadOf }
}

/** A member of a value read as an object. */
const memberOf = (value: unknown, name: string): unknown =>
    typeof value === "object" && value !== null ? Reflect.get(value, name) : undefined

describe("StopCardsService posts the card of a stop", () => {
    it("posts it under the step's key, typed open with the three decisions, and no raw facts in its line", async () => {
        const { cards, post, payloadOf } = await build()

        await expect(cards.posted("ws-1", STOP, CONTEXT, NOW)).resolves.toBe("msg-1")

        const [turn, , call] = post.execute.mock.calls[0] ?? []
        expect(turn).toMatchObject({ workspaceId: "ws-1", agentId: "agent-1", conversationId: null, locale: "vi" })
        expect(call).toEqual({ key: `${stopCardKeyOf("run-1", "match")}:2`, dedupeKey: "run-stuck:run-1:match" })
        expect(payloadOf(0)).toMatchObject({
            kind: "workflow.stopped",
            title: "[teamChat.stopCard.open.ai_report]",
            summary: "A credit of 1,000 names no order\nIs it for SO-0003?",
        })
        const card = memberOf(payloadOf(0), "card")
        expect(workflowStoppedPayload.parse(card)).toMatchObject({
            workflow: CONTEXT.workflow,
            step: CONTEXT.step,
            runId: "run-1",
            leadId: null,
            by: "ai",
            decisions: ["retry", "take_over", "skip"],
            facts: [{ name: "amount", value: "1,000" }],
            repeats: 2,
        })
        expect(memberOf(card, "stop")).toEqual({
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
            approval: null,
        })
    })

    it("asks a verdict on a permission request, and names an AI failure and an engine stop as NIVO's report", async () => {
        const { cards, payloadOf } = await build()

        await cards.posted("ws-1", { ...STOP, kind: "approval" }, CONTEXT, NOW)
        const card = memberOf(payloadOf(0), "card")
        expect(memberOf(card, "stop")).toMatchObject({
            kind: "approval",
            needs: { answer: false, decisions: [], verdicts: ["approve", "refuse"] },
        })
        expect(workflowStoppedPayload.parse(card).decisions).toEqual([])

        await cards.posted("ws-1", { ...STOP, kind: "ai_error" }, { ...CONTEXT, by: "engine" }, NOW)
        expect(payloadOf(1)).toMatchObject({ title: "[teamChat.stopCard.open.ai_error]" })
        expect(cards.sectionOf({ ...STOP, kind: "engine" }, "vi").kind).toBe("ai_error")
    })

    it("names what a permission request asks: its work item, tool, account, ability and arguments; the machinery keys never shown", async () => {
        const { cards, payloadOf } = await build()
        const facts = [
            { name: "workItemId", value: "item-1" },
            { name: "tool", value: "Send a customer message" },
            { name: "account", value: "Zalo OA Shop" },
            { name: "ability", value: "customer.send" },
            { name: "fingerprint", value: "f1" },
            { name: "text", value: "Hello" },
        ]
        const approval = {
            ...STOP,
            kind: "approval" as const,
            reason: "Agent asks to send a message",
            detail: { suggestions: [], facts },
        }

        await cards.posted("ws-1", approval, CONTEXT, NOW)

        const card = memberOf(payloadOf(0), "card")
        expect(memberOf(payloadOf(0), "title")).toBe("Agent asks to send a message")
        expect(memberOf(card, "stop")).toMatchObject({
            headline: "Agent asks to send a message",
            approval: {
                workItemId: "item-1",
                tool: "Send a customer message",
                account: "Zalo OA Shop",
                ability: "customer.send",
                args: [{ name: "text", value: "Hello" }],
            },
        })
        expect(workflowStoppedPayload.parse(card).facts.map((fact) => fact.name)).toEqual([
            "tool",
            "account",
            "ability",
            "text",
        ])
    })

    it("posts nothing where the app serves no team post", async () => {
        const { cards, post } = await build(false)
        await expect(cards.posted("ws-1", STOP, CONTEXT, NOW)).resolves.toBeNull()
        await cards.rewritten("ws-1", STOP, "vi")
        expect(post.execute).not.toHaveBeenCalled()
    })
})

describe("StopCardsService rewrites the card of a stop in place", () => {
    it("on an answer: the one card, the founder's words, who and when kept on it", async () => {
        const { cards, post, payloadOf } = await build()
        const answer = { kind: "answer" as const, text: "Keep the order open", by: "seat-1", at: NOW }

        await cards.rewritten("ws-1", { ...STOP, answers: [answer], decision: answer }, "vi")

        expect(post.execute.mock.calls[0]?.[2]).toEqual({
            key: "run-stuck:run-1:match:answered:2:1",
            dedupeKey: "run-stuck:run-1:match",
        })
        expect(memberOf(payloadOf(0), "kind")).toBe("workflow.stopped")
        const rewrite = memberOf(payloadOf(0), "rewrite")
        expect(memberOf(rewrite, "title")).toBe("[teamChat.stopCard.answered]")
        expect(memberOf(rewrite, "stop")).toMatchObject({
            state: "answered",
            needs: NOTHING,
            replies: [{ kind: "answer", text: "Keep the order open", by: "seat-1", at: NOW }],
        })
    })

    it("when resolved, under the same key; nothing posts for a stop that never had a card", async () => {
        const { cards, post, payloadOf } = await build()

        await cards.resolved("ws-1", { ...STOP, state: "resolved" }, "vi", NOW)
        expect(memberOf(memberOf(payloadOf(0), "rewrite"), "stop")).toMatchObject({
            state: "resolved",
            resolvedAt: NOW,
        })
        expect(post.execute.mock.calls[0]?.[2]).toMatchObject({ dedupeKey: "run-stuck:run-1:match" })

        post.execute.mockClear()
        await cards.resolved("ws-1", { ...STOP, cardMessageId: null }, "vi", NOW)
        await cards.rewritten("ws-1", { ...STOP, cardMessageId: null }, "vi")
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
        expect(read).toEqual({
            state: "answered",
            needs: { answer: true, decisions: ["retry", "skip"], verdicts: [] },
            takenOver: true,
        })
    })
})
