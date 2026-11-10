import { JobRetry } from "@nivo-lite/agent-sdk/mutation"
import { ORDER, orderOf } from "../../../rules/accounting/accounting.fixtures"
import type { OrderRecord } from "../../../rules/accounting/accounting.types"
import { confirmationText } from "../../../rules/accounting/settle"
import { doorApi, entityApi, memoryWorld, putConversation, putOrder } from "../fixtures/accounting.memory"
import type { MemoryWorld } from "../fixtures/accounting.memory"
import { copyOf } from "../messages/copy"
import { CHAT_SEND_TOOL, confirmNoticeJob } from "./confirm-notice.job"

const CONTEXT = { workspaceId: "w1", attempt: 2, effectKey: (step: string): string => `effect:${step}` }
const LEAD = "00000000-0000-4000-8000-0000000000c1"

const worldOf = (order: OrderRecord | null, conversation: boolean): MemoryWorld => {
    const world = memoryWorld()
    if (order !== null) putOrder(world, order)
    if (conversation) putConversation(world, "conv-1", LEAD, "2026-11-04T10:00:00.000Z")
    world.answers.set(CHAT_SEND_TOOL, { ok: true, output: { sent: true } })
    return world
}

const run = (world: MemoryWorld): Promise<void> =>
    confirmNoticeJob.run(
        {
            orders: entityApi(world, "sales.order"),
            conversations: entityApi(world, "chat.conversation"),
            door: doorApi(world),
        },
        { orderId: ORDER.id },
        CONTEXT,
    )

describe("payment.confirm-notice", () => {
    it("declares itself with the order id only in its payload", () => {
        expect(confirmNoticeJob.name).toBe("payment.confirm-notice")
        expect(Object.keys(confirmNoticeJob.input.shape)).toEqual(["orderId"])
    })

    it("tells the customer on the conversation they wrote in last, keyed by the order", async () => {
        const world = worldOf(ORDER, true)
        await run(world)
        expect(world.calls).toEqual([
            {
                tool: CHAT_SEND_TOOL,
                input: {
                    conversationId: "conv-1",
                    text: confirmationText(copyOf("settle_confirmation", "vi"), ORDER.orderNo, 5_000_000),
                    key: "effect:notice",
                },
            },
        ])
    })

    it("tells an order with no price a zero amount rather than nothing", async () => {
        const world = worldOf(orderOf({ amountVnd: null }), true)
        await run(world)
        expect(JSON.stringify(world.calls[0]?.input)).toContain(" 0 ")
    })

    it("tells nobody when the order is gone, has no customer, or the customer never wrote", async () => {
        for (const world of [worldOf(null, true), worldOf(orderOf({ leadId: null }), true), worldOf(ORDER, false)]) {
            await run(world)
            expect(world.calls).toEqual([])
        }
    })

    it("has the queue deliver again when the channel is away, and parks the job when the door refuses", async () => {
        const away = worldOf(ORDER, true)
        away.answers.set(CHAT_SEND_TOOL, { ok: false, reason: "transient", message: "503" })
        await expect(run(away)).rejects.toBeInstanceOf(JobRetry)
        const refused = worldOf(ORDER, true)
        refused.answers.set(CHAT_SEND_TOOL, { ok: false, reason: "forbidden", message: "403" })
        await expect(run(refused)).rejects.toThrow("JOB_REFUSED: nivo.chat.send forbidden")
    })
})
