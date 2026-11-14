import { TOOL, type ToolId } from "@nivo-lite/agent-sdk/names"
import { NodeBusinessFailure } from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { FailReason, NodeContext } from "@nivo-lite/agent-sdk/template"
import { answered, contextAnswer, sentAnswer } from "../../../shared/nodes/tool-answers"
import { salesConsultTurnNode } from "./consult-turn.node"
import { salesOrderTalkNode } from "./order-talk.node"
import { salesPaidClaimReplyNode } from "./paid-claim-reply.node"

// QUEUE-DESIGN "single-line readers" (1), (3), (4), ruling R73: the engine may wake a step ONCE for several lines of the person (a burst, or
// lines held while the run was busy). A step that judges or answers the person reads what the person said since the shop last spoke from
// the engine's thread (`nivo.tool.conversation.message.list`), pictures included: `trigger.data.text` / the wait's event is only the line
// that woke it. Each node below is fed a thread with FOUR unread lines (one a picture) and must hand all of them to its model and answer once.

const PICTURE = "https://files.example/receipt.jpg"

/** One line of the engine's conversation, as the read answers it. */
type Line = {
    readonly role: string
    readonly text: string
    readonly at: string
    readonly files?: ReadonlyArray<{ readonly url: string | null; readonly contentType: string }>
}

/** The thread, oldest first: an old line, the shop's last line, then four unread lines of the person (the third a picture only). */
const THREAD: ReadonlyArray<Line> = [
    { role: "user", text: "an old line already answered", at: "2026-11-14T08:00:00.000Z" },
    { role: "agent", text: "the shop's last line", at: "2026-11-14T08:01:00.000Z" },
    { role: "user", text: "first", at: "2026-11-14T08:02:00.000Z" },
    { role: "user", text: "second", at: "2026-11-14T08:02:05.000Z" },
    { role: "user", text: "", at: "2026-11-14T08:02:10.000Z", files: [{ url: PICTURE, contentType: "image/jpeg" }] },
    { role: "user", text: "fourth", at: "2026-11-14T08:02:15.000Z" },
]

/** What the model must be handed as the person's words: every unread line with words, oldest first, one per line. */
const ALL_UNREAD = "first\nsecond\nfourth"

/** What a stand-in model was asked: the request's input and its pictures. */
interface Asked {
    readonly input: JsonValue
    readonly images: ReadonlyArray<string> | undefined
}

/**
 * The smallest stand-in for the engine's host: answers the reads (the thread newest first, as the engine's read answers it), records every
 * call and what the model was asked, and answers the model with `answer`.
 */
const hostOf = (answer: JsonValue) => {
    const asked: Array<Asked> = []
    const calls: Array<[ToolId, unknown]> = []
    const answers: Partial<Record<ToolId, unknown>> = {
        [TOOL.conversationMessageList]: answered({ facts: [...THREAD].toReversed() }),
        [TOOL.brainFactList]: answered({ facts: [] }),
        [TOOL.leadOrderList]: contextAnswer("nivo.lead", []),
        [TOOL.contactGet]: contextAnswer("nivo.lead", [{ id: "lead-1", memory: {} }]),
        [TOOL.customerMessageSend]: sentAnswer("msg-1", "route-1"),
    }
    const context = {
        params: {},
        run: { id: "run-1", at: "2026-11-14T08:03:00.000Z", day: "2026-11-14", item: null, queue: [], waiting: 0 },
        subject: null,
        policy: {},
        workspace: { timeZone: "Asia/Ho_Chi_Minh", name: "Shop" },
        tools: { call: (id: ToolId, given: unknown) => (calls.push([id, given]), Promise.resolve(answers[id])) },
        agent: {
            run: (request: { readonly input: JsonValue; readonly images?: ReadonlyArray<string> }) => {
                asked.push({ input: request.input, images: request.images })
                return Promise.resolve(answer)
            },
        },
        fail: (reason: FailReason): never => {
            throw new NodeBusinessFailure({ code: reason.kind, messageKey: "specStop", message: JSON.stringify(reason), fields: {} })
        },
    } as unknown as NodeContext
    const sends = () => calls.filter(([id]) => id === TOOL.customerMessageSend)
    return { context, asked, calls, sends }
}

/** The member `name` of what the model was handed. */
const memberOf = (asked: Asked | undefined, name: string): unknown =>
    asked !== undefined && typeof asked.input === "object" && asked.input !== null && !Array.isArray(asked.input)
        ? asked.input[name]
        : undefined

describe("sales.consult-turn: a turn answers every line since the shop last spoke, not only the line that woke it (QUEUE-DESIGN (3))", () => {
    const draft = {
        branch: "asked",
        reply: "One answer for all four lines",
        items: [],
        address: null,
        recipientName: null,
        recipientPhone: null,
        deliveryAt: null,
        occasions: null,
        cancelOrderId: null,
        cancelReason: null,
    }

    it("round 2 woken by the FIRST line: the model reads all four unread lines and the picture, and one message is sent", async () => {
        const host = hostOf(draft)
        await salesConsultTurnNode.run(
            { conversationId: "route-1", text: "the hand-off's words", latest: "first", channel: "zalo", contactId: "contact-1", locale: "en" },
            host.context,
        )
        expect(host.asked).toHaveLength(1)
        expect(memberOf(host.asked[0], "text")).toBe(ALL_UNREAD)
        expect(host.asked[0]?.images).toEqual([PICTURE])
        expect(host.sends()).toHaveLength(1)
    })

    it("round 1: the hand-off's words give way to the thread's unread lines", async () => {
        const host = hostOf(draft)
        await salesConsultTurnNode.run({ conversationId: "route-1", text: "first", channel: "zalo", contactId: "contact-1", locale: "en" }, host.context)
        expect(memberOf(host.asked[0], "text")).toBe(ALL_UNREAD)
    })
})

describe("sales.order-talk: the pay loop's talk answers every unread line once (QUEUE-DESIGN (1))", () => {
    it("woken by one line of four: reads the thread, hands the model all four and the picture, sends ONE answer", async () => {
        const host = hostOf({ topic: "about", reply: "One answer about the order" })
        const output = await salesOrderTalkNode.run(
            { contactId: "contact-1", text: "first", orderNo: "DH-20261114-0001", amountVnd: 4500, locale: "en" },
            host.context,
        )
        expect(host.calls[0]?.[0]).toBe(TOOL.conversationMessageList)
        expect(memberOf(host.asked[0], "message")).toBe(ALL_UNREAD)
        expect(host.asked[0]?.images).toEqual([PICTURE])
        expect(host.sends()).toHaveLength(1)
        expect(output).toEqual({ topic: "about", sent: true, refusal: null })
    })

    it("a thread with nothing unread (the shop spoke last) falls back to the line that woke the step", async () => {
        const host = hostOf({ topic: "off", reply: null })
        const answers = host.context.tools.call.bind(host.context.tools)
        const quiet = {
            ...host.context,
            tools: {
                call: (id: ToolId, given: unknown) =>
                    id === TOOL.conversationMessageList ? Promise.resolve(answered({ facts: [{ role: "agent", text: "x", at: "2026-11-14T08:01:00.000Z" }] })) : answers(id as never, given as never),
            },
        } as unknown as NodeContext
        await salesOrderTalkNode.run({ contactId: "contact-1", text: "the woken line", orderNo: "DH-1", amountVnd: 1, locale: "en" }, quiet)
        expect(memberOf(host.asked[0], "message")).toBe("the woken line")
        expect(host.sends()).toHaveLength(0)
    })
})

describe("sales.paid-claim-reply: a claim answers the lines said after the front desk heard it too (QUEUE-DESIGN (4))", () => {
    it("hands the model all four unread lines and the transfer picture, sends ONE answer, and hands the same words on for the team", async () => {
        const host = hostOf({ text: "Thank you, the shop sees it once the bank reports it." })
        const output = await salesPaidClaimReplyNode.run({ conversationId: "route-1", text: "first", locale: "en" }, host.context)
        expect(memberOf(host.asked[0], "text")).toBe(ALL_UNREAD)
        expect(host.asked[0]?.images).toEqual([PICTURE])
        expect(host.sends()).toHaveLength(1)
        expect(output).toEqual({ text: "Thank you, the shop sees it once the bank reports it.", declined: false, heard: ALL_UNREAD })
    })

    it("a hand-off with no words (the front desk heard a picture-only line) is accepted at its input and answered from the thread", async () => {
        const host = hostOf({ text: "Thank you." })
        const output = await salesPaidClaimReplyNode.run({ conversationId: "route-1", text: "", locale: "en" }, host.context)
        expect(output.declined).toBe(false)
        expect(host.sends()).toHaveLength(1)
    })
})
