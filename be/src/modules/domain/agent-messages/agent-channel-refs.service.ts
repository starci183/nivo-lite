import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { OptionalChannelMessageId } from "./agent-channel-refs.contracts"
import { AgentMessageEntity } from "./persistence/entities"

/** The role of a message a customer wrote, the only one a channel brings in. */
const CUSTOMER_ROLE = "user"

@Injectable()
/**
 * The channel's own id of a customer message (`zalo:<message id>`, `tg:<chat>:<message>`, `meta:<event>`), kept on the row that stores it so
 * the same message heard twice in one conversation - a webhook and the poll that reconciles it, a manual import, a replayed inbound event - is
 * stored once. The database holds the rule (`agent_messages_channel_ref_key`, one row per conversation and channel id): a second row of the
 * same message fails the transaction that wrote it, and that transaction's retry finds the first.
 */
export class AgentChannelRefsService {
    /** The customer message of the conversation that stores this channel message, in the caller's transaction; null when none does yet. */
    async messageOf(
        conversationId: string,
        channelRef: string,
        manager: EntityManager,
    ): Promise<OptionalChannelMessageId> {
        const row = await manager.findOne(AgentMessageEntity, {
            select: { id: true },
            where: { conversationId, channelRef, role: CUSTOMER_ROLE },
        })
        return row?.id ?? null
    }

    /** Notes on a customer message just stored, in the caller's transaction, the channel message it stores. */
    async mark(messageId: string, channelRef: string, manager: EntityManager): Promise<void> {
        await manager.update(AgentMessageEntity, { id: messageId }, { channelRef })
    }
}
