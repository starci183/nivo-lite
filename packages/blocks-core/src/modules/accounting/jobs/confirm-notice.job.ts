import { defineJob, doorPort, endAfterDoor, type DoorApi, type JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { z } from "zod"
import { confirmationText } from "../../../rules/accounting/settle"
import { latestConversationOfLead, orderById } from "../accounting-data"
import { copyOf } from "../messages/copy"
import { CONVERSATIONS, ORDERS } from "../ports"

/** The door tool that sends a message to a customer on the channel they wrote from. */
export const CHAT_SEND_TOOL = "chat.send"

/** The name of the job: the outbox enqueues it by this name. */
const JOB_NAME = "payment.confirm-notice"

/** How many times the queue delivers the job before it is parked. */
const ATTEMPTS = 8

const input: z.ZodObject<{ orderId: z.ZodUUID }> = z.object({ orderId: z.uuid() })

/** The port definitions of the job, by the name `run` reaches them by. */
type ConfirmNoticePorts = {
    /** The orders. */
    readonly orders: PortDefinition<EntityApi>
    /** The conversations. */
    readonly conversations: PortDefinition<EntityApi>
    /** The door out of the system. */
    readonly door: PortDefinition<DoorApi>
}

const ports: ConfirmNoticePorts = { orders: ORDERS, conversations: CONVERSATIONS, door: doorPort }

/**
 * `payment.confirm-notice`: after an order was marked paid, tells the customer on the conversation they wrote in last. It is the
 * outbox job `payment.settle` enqueues in its transaction, so the message leaves outside it. A customer who never wrote is told
 * nothing. The message carries the effect key of the job, so a repeat delivery tells the customer once.
 */
export const confirmNoticeJob: JobDefinition<typeof input, ConfirmNoticePorts> = defineJob({
    name: JOB_NAME,
    input,
    ports,
    attempts: ATTEMPTS,
    run: async ({ orders, conversations, door }, given, context) => {
        const order = await orderById(orders, given.orderId)
        const leadId = order?.leadId ?? null
        if (order === null || leadId === null) return
        const conversationId = await latestConversationOfLead(conversations, leadId)
        if (conversationId === null) return
        const text = confirmationText(copyOf("settle_confirmation", "vi"), order.orderNo, order.amountVnd ?? 0)
        const sent = await door.call(CHAT_SEND_TOOL, { conversationId, text, key: context.effectKey("notice") })
        endAfterDoor(JOB_NAME, CHAT_SEND_TOOL, sent)
    },
})
