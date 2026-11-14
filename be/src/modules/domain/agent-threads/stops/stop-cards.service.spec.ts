import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { workflowStoppedPayload } from "@nivo-lite/agent-sdk/team-chat"
import { GraphNodeRegistryService, type NodeEffectExecutor } from "@modules/domain/graph-nodes"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
import { DO_NOT_SEND_VI, SEND_QR_REASON_VI } from "@tests/fixtures/i18n/agent-threads-spec.messages"
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
    contactId: null,
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

    it("posts nothing where the app serves no team post", async () => {
        const { cards, post } = await build(false)
        await expect(cards.posted("ws-1", STOP, CONTEXT, NOW)).resolves.toBeNull()
        await cards.rewritten("ws-1", STOP, "vi")
        expect(post.execute).not.toHaveBeenCalled()
    })
})

describe("StopCardsService posts the card of a permission request or a failure", () => {
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
})

describe("StopCardsService carries the approval card the engine built before the write (team-chat rule 9)", () => {
    const CARD = {
        step: { nodeId: "sales.payment-qr", title: "Make QR", description: "" },
        call: { tool: "nivo.tool.payment.transfer.create", account: "SePay · MB 5252" },
        facts: [{ name: "amountVnd", value: "250000" }],
        text: "Tạo mã QR 250.000đ.",
        preview: { kind: "sales.order.summary", payload: { orderNo: "DH-7" } },
    }
    const ASKING: RunStop = { ...STOP, kind: "approval", detail: { ...STOP.detail, approvalCard: CARD } }

    it("posts it as the decision of the permission request, its preview on the card, and keeps it on every rewrite", async () => {
        const { cards, payloadOf } = await build()

        await cards.posted("ws-1", ASKING, CONTEXT, NOW)
        await cards.rewritten("ws-1", ASKING, "vi")

        expect(memberOf(payloadOf(0), "decision")).toEqual(CARD)
        expect(memberOf(memberOf(payloadOf(0), "card"), "preview")).toEqual(CARD.preview)
        expect(memberOf(payloadOf(1), "decision")).toEqual(CARD)
    })

    it("a stop with no approval card posts none", async () => {
        const { cards, payloadOf } = await build()

        await cards.posted("ws-1", STOP, CONTEXT, NOW)

        expect(payloadOf(0)).not.toHaveProperty("decision")
        expect(memberOf(payloadOf(0), "card")).not.toHaveProperty("preview")
    })
})

describe("StopCardsService rewrites the card of a stop in place", () => {
    it("on an answer: the one card, the founder's words, who and when kept on it", async () => {
        const { cards, post, payloadOf } = await build()
        const answer = { kind: "answer" as const, text: "Keep the order open", by: "seat-1", at: NOW }

        await cards.rewritten("ws-1", { ...STOP, answers: [answer], decision: answer }, "vi")

        expect(post.execute.mock.calls[0]?.[2]).toEqual({
            key: "run-stuck:run-1:match:answered:2:1:f1",
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

describe("StopCardsService: a rewrite carries what the record says about the engine's holding line", () => {
    const keyOf = (post: Awaited<ReturnType<typeof build>>["post"], nth: number): string => String(post.execute.mock.calls[nth]?.[2].key)

    it("hands the two raw line facts when the stop has them, and the key ends with the reason", async () => {
        const { cards, post, payloadOf } = await build()
        const facts = [
            { name: "amount", value: "1,000" },
            { name: "customerLine", value: "not_told" },
            { name: "customerLineReason", value: "ability_off" },
        ]

        await cards.rewritten("ws-1", { ...STOP, detail: { ...STOP.detail, facts } }, "vi")

        expect(memberOf(memberOf(payloadOf(0), "rewrite"), "lineFacts")).toEqual([
            { name: "customerLine", value: "not_told" },
            { name: "customerLineReason", value: "ability_off" },
        ])
        expect(keyOf(post, 0)).toMatch(/^run-stuck:run-1:match:[a-z_]+:2:0:f3:ability_off$/)
    })

    it("hands an empty list and keys no reason when the stop says nothing of the line; a second reason is another key", async () => {
        const { cards, post, payloadOf } = await build()

        await cards.rewritten("ws-1", STOP, "vi")
        const notTold = (reason: string) => ({
            ...STOP,
            detail: {
                ...STOP.detail,
                facts: [...STOP.detail.facts, { name: "customerLine", value: "not_told" }, { name: "customerLineReason", value: reason }],
            },
        })
        await cards.rewritten("ws-1", notTold("ability_off"), "vi")
        await cards.rewritten("ws-1", notTold("not_attached"), "vi")

        expect(memberOf(memberOf(payloadOf(0), "rewrite"), "lineFacts")).toEqual([])
        expect(keyOf(post, 0)).toMatch(/:f1$/)
        expect(keyOf(post, 1)).toMatch(/:f3:ability_off$/)
        expect(keyOf(post, 2)).toMatch(/:f3:not_attached$/)
        expect(new Set([keyOf(post, 0), keyOf(post, 1), keyOf(post, 2)]).size).toBe(3)
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
        ["resolved by a take-over handed back (rule S-3)", "resolved", "handed_back", "handed_back", false],
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

// D-MX-10: the owner's verdict on a permission request is read in the card's own trace (who, what, when), so no line is posted beside it.
describe("StopCardsService: a verdict on a permission request is in the card's trace (D-MX-10)", () => {
    const approval = (answers: RunStop["answers"]): RunStop => ({
        ...STOP,
        kind: "approval",
        reason: SEND_QR_REASON_VI,
        detail: { suggestions: [], facts: [{ name: "workItemId", value: "item-7" }] },
        answers,
        decision: answers.at(-1) ?? null,
    })

    it("approved: the trace says approve, by the owner, at the time", async () => {
        const { cards } = await build()
        const section = cards.sectionOf(approval([{ kind: "retry", text: null, by: "seat-owner", at: NOW }]), "vi")
        expect(section.replies).toEqual([{ kind: "approve", text: null, by: "seat-owner", at: NOW }])
    })

    it("refused: the trace says refuse with the owner's words; a deadline stays a timeout", async () => {
        const { cards } = await build()
        const refused = cards.sectionOf(approval([{ kind: "answer", text: DO_NOT_SEND_VI, by: "seat-owner", at: NOW }]), "vi")
        expect(refused.replies).toEqual([{ kind: "refuse", text: DO_NOT_SEND_VI, by: "seat-owner", at: NOW }])
        const late = cards.sectionOf(approval([{ kind: "timeout", text: null, by: "deadline", at: NOW }]), "vi")
        expect(late.replies.map((reply) => reply.kind)).toEqual(["timeout"])
    })

    it("any other stop keeps its replies as they were", async () => {
        const { cards } = await build()
        const section = cards.sectionOf({ ...STOP, answers: [{ kind: "retry", text: null, by: "seat-1", at: NOW }] }, "vi")
        expect(section.replies.map((reply) => reply.kind)).toEqual(["retry"])
    })
})
