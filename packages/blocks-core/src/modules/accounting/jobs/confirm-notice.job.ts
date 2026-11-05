import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { confirmationText } from "../../../rules/accounting/settle"
import type { ConversationFinder, Door, OrderStore } from "../accounting.types"
import { copyOf } from "../messages/copy"
import { conversationsPort, doorPort, ordersPort } from "../ports"
import { DONE, defineJob, resultOf } from "./job"
import type { JobDefinition } from "./job"

/** The door tool that sends a message to a customer on the channel they wrote from. */
export const CHAT_SEND_TOOL = "chat.send"

const input: z.ZodObject<{ orderId: z.ZodUUID }> = z.object({ orderId: z.uuid() })

type ConfirmNoticePorts = {
    readonly orders: PortDefinition<OrderStore>
    readonly conversations: PortDefinition<ConversationFinder>
    readonly door: PortDefinition<Door>
}

const ports: ConfirmNoticePorts = { orders: ordersPort, conversations: conversationsPort, door: doorPort }

/**
 * `payment.confirm-notice`: after an order was marked paid, tells the customer on the conversation they wrote in last. It is the
 * outbox job `payment.settle` enqueues in its transaction, so the message leaves outside it. A customer who never wrote is told
 * nothing. The message carries the effect key of the job, so a repeat delivery tells the customer once.
 */
export const confirmNoticeJob: JobDefinition<typeof input, ConfirmNoticePorts> = defineJob({
    name: "payment.confirm-notice",
    input,
    ports,
    attempts: 8,
    run: async ({ orders, conversations, door }, given, context) => {
        const order = await orders.get(given.orderId)
        if (order === null) return DONE
        if (order.leadId === null) return DONE
        const conversationId = await conversations.latestOfLead(order.leadId)
        if (conversationId === null) return DONE
        const text = confirmationText(copyOf("settle_confirmation", "vi"), order.orderNo, order.amountVnd ?? 0)
        const sent = await door.call(CHAT_SEND_TOOL, { conversationId, text, effectKey: context.effectKey("notice") })
        return resultOf(CHAT_SEND_TOOL, sent)
    },
})
