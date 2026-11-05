import { ORDER, orderOf } from "../../../rules/accounting/accounting.fixtures"
import type { OrderRecord } from "../../../rules/accounting/accounting.types"
import { confirmationText } from "../../../rules/accounting/settle"
import { copyOf } from "../messages/copy"
import { conversationFinder, orderStore, scriptedDoor } from "../accounting.doubles"
import type { DoorCallResult } from "../accounting.types"
import { CHAT_SEND_TOOL, confirmNoticeJob } from "./confirm-notice.job"
import type { JobContext } from "./job"

const CONTEXT: JobContext = { workspaceId: "w1", attempt: 2, effectKey: (step) => `effect:${step}` }

const harness = (order: OrderRecord | null, conversation: string | null, answer: DoorCallResult) => {
    const { door, calls } = scriptedDoor({ [CHAT_SEND_TOOL]: answer })
    const ports = {
        orders: orderStore({ get: () => Promise.resolve(order) }),
        conversations: conversationFinder({ latestOfLead: () => Promise.resolve(conversation) }),
        door,
    }
    return { calls, run: () => confirmNoticeJob.run(ports, { orderId: ORDER.id }, CONTEXT) }
}

const sent: DoorCallResult = { ok: true, output: { sent: true } }

describe("payment.confirm-notice", () => {
    it("declares itself with the order id only in its payload", () => {
        expect(confirmNoticeJob.name).toBe("payment.confirm-notice")
        expect(Object.keys(confirmNoticeJob.input.shape)).toEqual(["orderId"])
    })

    it("tells the customer on the conversation they wrote in last, keyed by the order", async () => {
        const { calls, run } = harness(ORDER, "conv-1", sent)
        await run()
        expect(calls).toEqual([
            {
                tool: CHAT_SEND_TOOL,
                input: {
                    conversationId: "conv-1",
                    text: confirmationText(copyOf("settle_confirmation", "vi"), ORDER.orderNo, 5_000_000),
                    effectKey: "effect:notice",
                },
            },
        ])
    })

    it("tells an order with no price a zero amount rather than nothing", async () => {
        const { calls, run } = harness(orderOf({ amountVnd: null }), "conv-1", sent)
        await run()
        expect(JSON.stringify(calls[0]?.input)).toContain(" 0 ")
    })

    it("tells nobody when the order is gone, has no customer, or the customer never wrote", async () => {
        for (const { calls, run } of [
            harness(null, "conv-1", sent),
            harness(orderOf({ leadId: null }), "conv-1", sent),
            harness(ORDER, null, sent),
        ]) {
            await run()
            expect(calls).toEqual([])
        }
    })

    it("answers the door's verdict when the message cannot be sent", async () => {
        const { run } = harness(ORDER, "conv-1", { ok: false, reason: "transient", message: "503" })
        await expect(run()).resolves.toMatchObject({ ok: false, tool: CHAT_SEND_TOOL, transient: true })
    })
})
