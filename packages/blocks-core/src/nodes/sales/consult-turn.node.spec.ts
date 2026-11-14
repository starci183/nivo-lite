import { DEFAULT_AI_READ_TOOLS, TOOL, type ToolId } from "@nivo-lite/agent-sdk/names"
import { NodeBusinessFailure } from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { FailReason, NodeContext } from "@nivo-lite/agent-sdk/template"
import { sampleOf } from "../../messages/catalog"
import { customerPicturesOf, salesConsultTurnNode } from "./consult-turn.node"
import { sentAnswer, answered, contextAnswer } from "../tool-answers"

/** The person who received the last order. */
const RECIPIENT = sampleOf("sampleConsultRecipient")
/** The address the last order was delivered to. */
const LAST_ADDRESS = sampleOf("sampleConsultLastAddress")
/** The older address lead memory remembers. */
const REMEMBERED_ADDRESS = sampleOf("sampleConsultRememberedAddress")
/** The address of a newer order that disagrees with the last one. */
const NEWER_ADDRESS = sampleOf("sampleConsultNewerAddress")

/** The customer's last order, as it was really delivered. */
const LAST_ORDER = {
    id: "o1",
    orderNo: "DH-20261110-0001",
    status: "paid",
    createdAt: "2026-11-10T08:00:00.000Z",
    recipientName: RECIPIENT,
    recipientPhone: "0900000000",
    deliveryAddress: LAST_ADDRESS,
    deliveryAt: sampleOf("sampleConsultDeliveryAt"),
    note: "",
}

const ASKED = {
    branch: "asked",
    reply: "Which address should we deliver to?",
    contactId: "contact-1",
    items: [],
    address: null,
    recipientName: RECIPIENT,
    recipientPhone: null,
    deliveryAt: null,
    occasions: null,
    cancelOrderId: null,
    cancelReason: null,
}

/** What the stand-in agent is handed: the one member the spec reads. */
interface AgentAsk {
    readonly input: JsonValue
}

/** One line of the engine's conversation, as `nivo.tool.conversation.message.list` answers it. */
type Line = {
    readonly role: string
    readonly text: string
    readonly at: string
    readonly files?: ReadonlyArray<{ readonly url: string | null; readonly contentType: string }>
}

/**
 * A context that answers the reads of a turn (the engine's thread, newest first, as the read answers it) and records what the agent is
 * handed and the args of each call: the smallest stand-in for the engine's host, so the spec sees the agent's request without the example
 * runner (which scripts only the agent's answer).
 */
const contextOf = (orders: ReadonlyArray<typeof LAST_ORDER>, address: string | null, thread: ReadonlyArray<Line> = []) => {
    const asked: Array<JsonValue> = []
    const args: Array<[ToolId, unknown]> = []
    const answers: Partial<Record<ToolId, unknown>> = {
        [TOOL.conversationMessageList]: answered({ facts: [...thread].toReversed() }),
        [TOOL.brainFactList]: answered({ facts: [] }),
        [TOOL.leadOrderList]: contextAnswer("nivo.lead", [...orders]),
        [TOOL.contactGet]: contextAnswer("nivo.lead", [
            { id: "lead-1", memory: address === null ? {} : { address } },
        ]),
        [TOOL.customerMessageSend]: sentAnswer("msg-1", "route-1"),
    }
    const context = {
        params: {},
        run: { id: "run-1", at: "2026-11-12T08:00:00.000Z", item: null },
        subject: null,
        policy: {},
        tools: { call: (id: ToolId, given: unknown) => (args.push([id, given]), Promise.resolve(answers[id])) },
        agent: {
            run: (request: AgentAsk) => {
                asked.push(request.input)
                const { contactId: _contactId, ...draft } = ASKED
                return Promise.resolve(draft)
            },
        },
        fail: (reason: FailReason): never => {
            throw new NodeBusinessFailure({ code: reason.kind, messageKey: "specStop", message: JSON.stringify(reason), fields: {} })
        },
    } as unknown as NodeContext
    return { context, asked, args }
}

// Design change (ruling R45): the thread is no longer handed on by the front door (`recentLines`, always empty from the sale, so the
// customer's pictures never reached it): the step reads the ENGINE's conversation of the run's route itself, from the visit's start.
describe("sales.consult-turn: the thread is the engine's conversation, read from the visit's start", () => {
    const picture = "https://files.example/mau.jpg"
    const thread: ReadonlyArray<Line> = [
        { role: "user", text: "cho chi 2 gio", at: "2026-11-13T08:00:00.000Z" },
        { role: "agent", text: "Shop co gio hoa nho 200k a", at: "2026-11-13T08:01:00.000Z" },
        { role: "user", text: "", at: "2026-11-13T08:02:00.000Z", files: [{ url: picture, contentType: "image/jpeg" }] },
    ]

    it("hands the agent the customer's and the shop's lines, oldest first, wordless lines aside, and shows the picture-only line's picture", async () => {
        const { context, asked, args } = contextOf([], null, thread)
        let images: unknown = null
        const agent = context.agent.run.bind(context.agent)
        const seeing = {
            ...context,
            agent: { run: (request: { readonly images?: unknown }) => ((images = request.images), agent(request as never)) },
        } as unknown as NodeContext
        await salesConsultTurnNode.run(
            { conversationId: "conv-1", text: "", channel: "zalo", contactId: "contact-1", since: "2026-11-13T07:59:00.000Z", locale: "vi" },
            seeing,
        )

        const seen = JSON.stringify(asked)
        expect(seen).toContain('"thread":["customer: cho chi 2 gio","shop: Shop co gio hoa nho 200k a"]')
        expect(images).toEqual([picture])
        expect(args[0]).toEqual([TOOL.conversationMessageList, { limit: 20, since: "2026-11-13T07:59:00.000Z" }])
    })
})

describe("sales.consult-turn: a previous delivery resolves from the customer's orders, not from older memory", () => {
    it('hands the agent the last order\'s address for "as the last order", and the remembered address only as labelled background', async () => {
        const { context, asked } = contextOf([LAST_ORDER], REMEMBERED_ADDRESS)
        await salesConsultTurnNode.run(
            {
                conversationId: "conv-1",
                text: sampleOf("sampleConsultDeliverLikeLast"),
                channel: "zalo",
                contactId: "contact-1",
                locale: "vi",
            },
            context,
        )

        const seen = JSON.stringify(asked)
        expect(seen).toContain('"recentOrders":[{"id":"o1","orderNo":"DH-20261110-0001"')
        expect(seen).toContain(`"deliveryAddress":"${LAST_ADDRESS}"`)
        expect(seen).toContain(`"recipientName":"${RECIPIENT}"`)
        expect(seen).toContain(`"remembered":{"address":"${REMEMBERED_ADDRESS}"}`)
        expect(seen).not.toContain(`"address":"${REMEMBERED_ADDRESS}","`)
    })

    it("hands every recent order in the order the read gives them (newest first) when they disagree on the address", async () => {
        const older = { ...LAST_ORDER, id: "o0", createdAt: "2026-11-10T07:00:00.000Z" }
        const newer = {
            ...LAST_ORDER,
            id: "o2",
            orderNo: "DH-20261110-0002",
            createdAt: "2026-11-10T09:00:00.000Z",
            deliveryAddress: NEWER_ADDRESS,
        }
        const { context, asked } = contextOf([newer, older], null)
        await salesConsultTurnNode.run(
            {
                conversationId: "conv-1",
                text: sampleOf("sampleConsultLikeLast"),
                channel: "zalo",
                contactId: "contact-1",
                locale: "vi",
            },
            context,
        )

        const seen = JSON.stringify(asked)
        const first = seen.indexOf(`"deliveryAddress":"${NEWER_ADDRESS}"`)
        const second = seen.indexOf(`"deliveryAddress":"${LAST_ADDRESS}"`)
        expect(first).toBeGreaterThan(-1)
        expect(second).toBeGreaterThan(first)
    })

    it("reads no order and no memory for a conversation that has no customer yet (the one write after the reads is the step's send)", async () => {
        const called: Array<ToolId> = []
        const { context } = contextOf([], null)
        const calls = context.tools.call.bind(context.tools)
        const counted = {
            ...context,
            tools: { call: (id: ToolId, args: never) => (called.push(id), calls(id, args)) },
        } as unknown as NodeContext
        await salesConsultTurnNode.run(
            { conversationId: "conv-1", text: "hi", channel: "zalo", contactId: null, locale: "vi" },
            counted,
        )

        // The engine's thread (R45), the price truths read, the send.
        expect(called).toEqual([TOOL.conversationMessageList, TOOL.brainFactList, TOOL.customerMessageSend])
    })
})

describe("sales.consult-turn: the routes and the draft", () => {
    const draft = {
        ...ASKED,
        branch: "ready",
        reply: null,
        items: [{ name: "small basket", quantity: 1, unitVnd: 2000 }],
        address: "x",
        recipientName: null,
        recipientPhone: "0901 234 567",
        deliveryAt: "Saturday 9-11",
    }

    // Design change (R33): the model may judge a message not about a sale (`off`): nothing is sent, the graph gives it back.
    it("routes on asked, ready, cancel or off, by its branch", () => {
        expect(salesConsultTurnNode.routes).toEqual({ by: "branch", names: ["asked", "ready", "cancel", "off", "declined"] })
        expect(salesConsultTurnNode.output.safeParse({ ...ASKED, contactId: null, recipientName: null }).success).toBe(
            true,
        )
    })

    it("refuses a ready draft without an item, an address, the recipient's phone or the delivery time; a new customer's ready turn has none", () => {
        expect(salesConsultTurnNode.output.safeParse(draft).success).toBe(true)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, recipientName: "Lan" }).success).toBe(true)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, address: null }).success).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, recipientPhone: null }).success).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, deliveryAt: null }).success).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, items: [] }).success).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, contactId: null }).success).toBe(true)
    })

    it("names the order to cancel on cancel, and only on cancel", () => {
        const cancel = {
            ...ASKED,
            branch: "cancel",
            reply: null,
            cancelOrderId: "o7",
            cancelReason: "no longer needed",
        }
        expect(salesConsultTurnNode.output.safeParse(cancel).success).toBe(true)
        expect(salesConsultTurnNode.output.safeParse({ ...cancel, cancelOrderId: null }).success).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...ASKED, cancelOrderId: "o7" }).success).toBe(false)
    })

    it("hands occasions on in the day format only, never an empty list", () => {
        expect(
            salesConsultTurnNode.output.safeParse({ ...ASKED, occasions: [{ label: "Lan's birthday", date: "11-21" }] })
                .success,
        ).toBe(true)
        expect(
            salesConsultTurnNode.output.safeParse({ ...ASKED, occasions: [{ label: "Lan", date: "2027-03-08" }] })
                .success,
        ).toBe(true)
        expect(
            salesConsultTurnNode.output.safeParse({ ...ASKED, occasions: [{ label: "Lan", date: "21/11" }] }).success,
        ).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...ASKED, occasions: [] }).success).toBe(false)
    })

    it("asks only on asked, with the one reply; ready and cancel send nothing", () => {
        expect(salesConsultTurnNode.output.safeParse({ ...ASKED, reply: null }).success).toBe(false)
        expect(salesConsultTurnNode.output.safeParse({ ...draft, reply: "ok" }).success).toBe(false)
    })

    it("reads the engine's thread, the orders and the memory, lets the agent search the truths and read only, and makes the send itself", () => {
        expect(salesConsultTurnNode.tools).toEqual([
            // The thread read is a default AI read reached from the node's own code (R45), so it is listed.
            TOOL.conversationMessageList,
            TOOL.contactGet,
            TOOL.leadOrderList,
            // The price truths are read by the node's OWN code (`priceFactsOf`): a default AI read is reached from code only when listed.
            TOOL.brainFactList,
            TOOL.customerMessageSend,
        ])
        // The truth and document reads are the SDK default of every AI step: the node lists none of them, the step is still shown them.
        for (const read of [TOOL.brainSearch, TOOL.brainPassageSearch, TOOL.brainPassageRead]) {
            expect(salesConsultTurnNode.tools).not.toContain(read)
            expect(DEFAULT_AI_READ_TOOLS).toContain(read)
        }
        expect(salesConsultTurnNode.requires).toBeUndefined()
    })
})

describe("sales.consult-turn: the pictures the customer sent are shown to the step (D-MX-4)", () => {
    const kept = "chat-file:ws-1/chat/customer/abc-0.jpg"
    // Thread rows in the ONE shape of `front-desk.reads.ts`: `{ role, text, at, files? }`; a picture the shop could not keep has no url.
    const rows = [
        {
            role: "user",
            text: sampleOf("sampleConsultPictureOld"),
            at: "2026-11-11T10:00:00.000Z",
            files: [{ url: "chat-file:old", contentType: "image/jpeg" }],
        },
        { role: "agent", text: sampleOf("sampleConsultShopYes"), at: "2026-11-11T10:01:00.000Z" },
        {
            role: "user",
            text: sampleOf("sampleConsultPictureAsk"),
            at: "2026-11-11T10:02:00.000Z",
            files: [{ url: kept, contentType: "image/jpeg" }],
        },
        {
            role: "user",
            text: sampleOf("sampleConsultPictureOnly"),
            at: "2026-11-11T10:02:05.000Z",
            files: [{ url: null, contentType: "image/*" }],
        },
    ]

    it("LIVE IMG: the pictures since the shop last spoke, a kept one by its address and one the shop could not keep with none", () => {
        expect(customerPicturesOf(rows)).toEqual([kept, ""])
    })

    it("a thread with no picture shows none", () => {
        expect(customerPicturesOf(rows.slice(0, 2))).toEqual([])
    })
})
