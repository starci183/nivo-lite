import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ChatCustomerId,
    ChatCustomerRef,
    LeadLinkSource,
    PushConversation,
    PushTarget,
} from "./loyalty-customer-links.contracts"
import {
    COUNT_REACHABLE,
    SELECT_CHAT_CUSTOMER,
    SELECT_PUSH_CONVERSATION,
    UPSERT_CHANNEL_LINKS,
    UPSERT_CONVERSATION_LINKS,
    UPSERT_LEAD_LINKS,
} from "./persistence/loyalty-customer-links.sql"

@Injectable()
/** Ties customers to the leads, conversations and chat accounts that already exist, without touching those tables. */
export class LoyaltyCustomerLinksService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Links the leads to the customers that own their contact, then their conversations and chat accounts; answers how many leads were linked. */
    async linkLeads(
        manager: EntityManager,
        workspaceId: string,
        leads: ReadonlyArray<LeadLinkSource>,
    ): Promise<number> {
        if (leads.length === 0) return 0
        const linked = await manager.query<Array<{ id: string }>>(UPSERT_LEAD_LINKS, [
            workspaceId,
            JSON.stringify(leads.map((lead) => ({ lead_id: lead.id, phone: lead.phone, email: lead.email }))),
        ])
        await manager.query(UPSERT_CONVERSATION_LINKS, [workspaceId])
        await manager.query(UPSERT_CHANNEL_LINKS, [workspaceId])
        return linked.length
    }

    /** How many of the customers have a chat that staff do not handle. */
    async countReachable(workspaceId: string, customerIds: ReadonlyArray<string>): Promise<number> {
        if (customerIds.length === 0) return 0
        const [row] = await this.entityManager.query<Array<{ total: number }>>(COUNT_REACHABLE, [
            workspaceId,
            customerIds,
        ])
        return row === undefined ? 0 : row.total
    }

    /** The chat to send a customer a message in, or null when the customer has none. */
    async pushConversation(workspaceId: string, customerId: string): Promise<PushTarget> {
        const [row] = await this.entityManager.query<Array<PushConversation>>(SELECT_PUSH_CONVERSATION, [
            workspaceId,
            customerId,
        ])
        return row ?? null
    }

    /** The member behind a chat, only through what NIVO already links to it: a stranger who types a phone number learns nothing. */
    async customerOfChat(ref: ChatCustomerRef): Promise<ChatCustomerId> {
        const account =
            ref.externalId === null || ref.externalId === ""
                ? null
                : `${ref.channel}:${ref.externalId.replace(/:.*$/u, "")}`
        const [row] = await this.entityManager.query<Array<{ customer_id: string }>>(SELECT_CHAT_CUSTOMER, [
            ref.workspaceId,
            ref.conversationId,
            ref.leadId,
            account,
        ])
        return row?.customer_id ?? null
    }
}
