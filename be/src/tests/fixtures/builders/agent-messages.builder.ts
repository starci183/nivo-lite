import { builder } from "@starci/jest-preset"
import { agentMessagesEntities } from "@modules/domain/agent-messages"

const [AgentMessageEntity] = agentMessagesEntities
type AgentMessageEntity = InstanceType<typeof AgentMessageEntity>

/** A stored conversation message, with the fields a spec rarely changes filled. */
export const messageOf = builder<AgentMessageEntity>({
    id: "msg-1",
    workspaceId: "ws-1",
    conversationId: "conv-1",
    role: "user",
    body: "Hello",
    createdAt: new Date("2026-10-12T10:00:00.000Z"),
    authorKind: null,
    authorName: null,
    deliveryStatus: null,
    deliveryError: null,
    inReplyTo: null,
    authorUserId: null,
})

/** The customer's first message, stamped in the +07 offset. */
export const customerMessageInLocalOffset = (): AgentMessageEntity =>
    messageOf({ id: "m-1", role: "user", createdAt: new Date("2026-10-12T17:00:00+07:00") })

/** A system line announcing the handover. */
export const handoverSystemMessage = (): AgentMessageEntity =>
    messageOf({ id: "m-2", role: "system", body: "Handed over", createdAt: new Date("2026-10-12T10:01:00Z") })

/** A human colleague's welcome. */
export const humanWelcomeMessage = (): AgentMessageEntity =>
    messageOf({ id: "m-3", role: "human", body: "Welcome", createdAt: new Date("2026-10-12T10:02:00Z") })

/** An earlier agent reply whose delivery failed. */
export const failedEarlierReply = (): AgentMessageEntity =>
    messageOf({ id: "r-0", body: "Old", deliveryStatus: "failed" })

/** An earlier agent reply that already reached the customer. */
export const sentEarlierReply = (): AgentMessageEntity => messageOf({ id: "r-0", body: "Old", deliveryStatus: "sent" })

/** A message that was delivered. */
export const deliveredMessage = (): AgentMessageEntity => messageOf({ deliveryStatus: "sent" })

/** The customer asking for a price. */
export const customerPriceQuestion = (): AgentMessageEntity => messageOf({ role: "user", body: "Price?" })

/** The agent's welcome reply. */
export const agentWelcomeReply = (): AgentMessageEntity => messageOf({ role: "agent", body: "Welcome" })
