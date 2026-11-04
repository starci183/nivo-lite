import { Injectable } from "@nestjs/common"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { In, IsNull, Not } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CustomerChat, CustomerChatRefs, OptionalLeadId } from "./agent-conversations.contracts"
import { AgentConversationEntity } from "./persistence/entities"

/** The most chats one reference lookup answers. */
const CHAT_LIMIT = 5000

@Injectable()
/** Read-only lookups of customer chats for the capabilities that only hold a reference to them. */
export class AgentConversationReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The customer chats of the workspace that are one of the named conversations or belong to one of the named leads, newest first. */
    async customerChatsOf(
        workspaceId: string,
        refs: CustomerChatRefs,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<CustomerChat>> {
        const base = { workspaceId, kind: "customer" } as const
        const where: Array<FindOptionsWhere<AgentConversationEntity>> = [
            ...(refs.conversationIds.length === 0 ? [] : [{ ...base, id: In([...refs.conversationIds]) }]),
            ...(refs.leadIds.length === 0 ? [] : [{ ...base, leadId: In([...refs.leadIds]) }]),
        ]
        if (where.length === 0) return []
        const rows = await manager.find(AgentConversationEntity, {
            select: { id: true, leadId: true, channel: true, externalId: true, handledBy: true, createdAt: true },
            where,
            order: { createdAt: "DESC", id: "DESC" },
            take: CHAT_LIMIT,
        })
        return rows.map((row) => ({
            id: row.id,
            leadId: row.leadId,
            channel: row.channel,
            externalId: row.externalId,
            handledBy: row.handledBy,
            createdAt: row.createdAt,
        }))
    }

    /**
     * The lead of the customer a channel knows by this contact id (a Zalo user, a Telegram chat), from the newest conversation of that
     * contact that has one; null when none does. The channel's own id is the customer's key: a display name, and above all the guest
     * placeholder every anonymous sender shares, never is.
     */
    async leadOfContact(workspaceId: string, channel: string, externalId: string): Promise<OptionalLeadId> {
        const row = await this.entityManager.findOne(AgentConversationEntity, {
            select: { id: true, leadId: true },
            where: { workspaceId, kind: "customer", channel, externalId, leadId: Not(IsNull()) },
            order: { createdAt: "DESC", id: "DESC" },
        })
        return row?.leadId ?? null
    }
}
