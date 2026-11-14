import { TOOL, type ToolId } from "@nivo-lite/agent-sdk/names"
import type { JsonObject, JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { FailReason, NodeContext, ToolAnswer } from "@nivo-lite/agent-sdk/template"
import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { salesAfterSaleNode } from "./care-after-sale.node"
import { CARE_OPEN, ORDER_O1, SENT_VIA_ZALO } from "./care.examples"
import { answered, contextAnswer } from "../tool-answers"
import { saleLeadListOf } from "./care.reads"

/** The paid order of the live walk: the customer corrected the address and the time in the consult. */
const ORDER = {
    ...ORDER_O1,
    orderNo: "DH-20261110-0001",
    items: [],
    delivery: {
        address: "12 Nguy\u1ec5n Hu\u1ec7 Q1",
        recipientName: "Lan",
        recipientPhone: "0900000000",
        deliveryAt: "10 gi\u1edd s\u00e1ng mai",
    },
}

/** The profile read: the name, and what lead memory remembers from an earlier consult (another address and another day). */
const PROFILE = contextAnswer("nivo.lead", [
    { id: "l1", name: "An", memory: { address: "57 Th\u1ea1ch H\u00e3n", deliveryAt: "Ng\u00e0y m\u1ed1t \u1ea1" } },
])

/** One scripted tool answer, by the id the call must name. */
interface Scripted {
    readonly id: ToolId
    readonly args: JsonObject
    readonly answer: ToolAnswer<JsonObject>
}

/** What a run of the node over scripted ports gave: its output, and every request it made of the agent, in order. */
interface Ran {
    readonly output: unknown
    readonly agentRequests: ReadonlyArray<{ readonly goal: string; readonly input: JsonValue }>
}

/**
 * Runs the node over scripted ports that RECORD what the agent was handed (the example runner checks outputs and calls, not what the
 * agent saw): the tools answer in order, the agent answers `reply`.
 */
const runRecorded = async (tools: ReadonlyArray<Scripted>, reply: JsonValue): Promise<Ran> => {
    const agentRequests: Array<{ readonly goal: string; readonly input: JsonValue }> = []
    let next = 0
    const context: NodeContext = {
        params: {},
        run: { id: "run-1", at: "2026-11-10T03:00:00.000Z", day: "2026-11-10", item: null, queue: [], waiting: 0 },
        subject: null,
        workspace: { timeZone: "Asia/Ho_Chi_Minh", name: "Shop" },
        tools: {
            call: (id, args) => {
                const scripted = tools[next]
                next += 1
                if (scripted?.id !== id) throw new Error(`unexpected call ${id}`)
                expect(args).toEqual(scripted.args)
                return Promise.resolve(scripted.answer)
            },
        },
        agent: {
            run: (request) => {
                agentRequests.push({ goal: request.goal, input: request.input })
                return Promise.resolve(request.output.parse(reply))
            },
        },
        policy: {},
        fail: (reason: FailReason): never => {
            throw new Error(JSON.stringify(reason))
        },
    }
    const output = await salesAfterSaleNode.run({ orderId: "o1", contactId: "c1", locale: "vi" }, context)
    expect(next).toBe(tools.length)
    return { output, agentRequests }
}

describe("sales.after-sale", () => {
    it("conforms: every example holds", async () => {
        expect(await checkTemplateNode(salesAfterSaleNode)).toEqual([])
    })

    it("hands the agent the order's address, recipient and time, and never the address lead memory remembers", async () => {
        const ran = await runRecorded(
            [
                { id: TOOL.orderGet, args: { orderId: "o1" }, answer: answered({ order: ORDER }) },
                { id: TOOL.recordList, args: saleLeadListOf("c1"), answer: answered({ records: [{ id: "l1", values: {} }], next: null }) },
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: answered(CARE_OPEN) },
                { id: TOOL.contactGet, args: {}, answer: PROFILE },
                { id: TOOL.customerMessageSend, args: { contactId: "c1", text: "C\u1ea3m \u01a1n ch\u1ecb!" }, answer: SENT_VIA_ZALO },
            ],
            { text: "C\u1ea3m \u01a1n ch\u1ecb!" },
        )

        const seen = JSON.stringify(ran.agentRequests)
        expect(ran.agentRequests).toHaveLength(1)
        expect(seen).toContain("12 Nguy\u1ec5n Hu\u1ec7 Q1")
        expect(seen).toContain("10 gi\u1edd s\u00e1ng mai")
        expect(seen).toContain("0900000000")
        expect(seen).not.toContain("57 Th\u1ea1ch H\u00e3n")
        expect(seen).not.toContain("Ng\u00e0y m\u1ed1t")
        // The output names the order code too (ruling R45: a team notice of an unsent thank-you names it).
        expect(ran.output).toEqual({ orderId: "o1", orderNo: "DH-20261110-0001", contactId: "c1", leadId: "l1", sent: true, refusal: null })
    })
})
