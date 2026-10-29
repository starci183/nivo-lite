import type { MockOf } from "@starci/jest-preset"
import type { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import type { AgentMessageDeliveriesService } from "@modules/domain/agent-messages"
import type { ChatConversation, ConversationTarget } from "@modules/domain/agent-conversations"
import type { AgentThreadMessage } from "@modules/domain/agent-messages"
import type { AgentProfile } from "@modules/domain/agents"
import type { ChatTurnFacts } from "@modules/domain/agent-chat"

const CHAT_NOW = "2026-10-13T02:00:00.000Z"

export const PROFILE: AgentProfile = {
    id: "a1",
    name: "Nivo",
    handle: "nivo",
    role: "receptionist",
    instructions: "Be brief",
    knowledge: "Open 9 to 6",
    approval_rule: "owner",
}

export const CONVERSATION: ChatConversation = {
    id: "c1",
    kind: "test",
    channel: "website",
    visitorName: "Lan",
    leadId: null,
    handledBy: null,
    createdAt: CHAT_NOW,
}

export const TARGET: ConversationTarget = {
    id: "c1",
    workspaceId: "w1",
    channel: "website",
    externalId: null,
    connectionId: null,
}

export const THREAD: AgentThreadMessage = { id: "m1", role: "user", body: "Hi", createdAt: CHAT_NOW }

export const TURN: ChatTurnFacts = {
    id: "m1",
    conversationId: "c1",
    channel: "website",
    role: "user",
    deliveryStatus: null,
    replyId: "r1",
    replyDeliveryStatus: null,
}

/** Makes the owners behind a chat turn answer the facts of one turn (none for a turn the workspace does not hold). */
export const arrangeTurnOwners = (
    deliveries: MockOf<AgentMessageDeliveriesService>,
    conversationReads: MockOf<AgentConversationsReadService>,
    turn: ChatTurnFacts | null,
): void => {
    deliveries.turnMessageOf.mockResolvedValue(
        turn === null
            ? null
            : {
                  id: turn.id,
                  conversationId: turn.conversationId,
                  role: turn.role,
                  deliveryStatus: turn.deliveryStatus,
              },
    )
    deliveries.agentReplyTo.mockResolvedValue(
        turn === null || turn.replyId === null ? null : { id: turn.replyId, deliveryStatus: turn.replyDeliveryStatus },
    )
    conversationReads.channelOf.mockResolvedValue(turn?.channel ?? null)
}
