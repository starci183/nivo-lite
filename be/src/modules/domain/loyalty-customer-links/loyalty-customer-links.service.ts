import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    ChatCustomerId,
    ChatCustomerRef,
    LeadLinkSource,
    PushConversation,
    PushTarget,
} from "./loyalty-customer-links.contracts"
import { LoyaltyCustomerLinkEntity } from "./persistence/entities"
import type { LoyaltyCustomerLinkKind } from "./persistence/entities"

/** The most links one statement writes. */
const WRITE_CHUNK = 1000

/** The most links one derived pass (conversations, chat accounts) reads and writes. */
const DERIVED_LIMIT = 5000

/** The most rows one chat lookup reads from each source: a chat has few links, and a lead matches at most two customers. */
const CHAT_LOOKUP_LIMIT = 10

/** A customer of the workspace as the lead matching reads it (the customers belong to another capability). */
interface CustomerContactRaw {
    /** The customer id. */
    readonly id: string
    /** The normalised phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
}

/** A customer and the reference a link points at. */
interface DerivedLinkRaw {
    /** The customer to link. */
    readonly customer_id: string
    /** The lead id, the conversation id or the `channel:account` text. */
    readonly ref: string
}

/** A customer found behind a chat and how directly the chat points at them (lower is more direct). */
interface RankedCustomerRaw {
    /** The customer. */
    readonly customer_id: string
    /** The rank: conversation, lead, channel account, phone, email. */
    readonly rank: number
}

/** A chat row as the push lookup reads it. */
interface PushConversationRaw extends PushConversation {
    /** Whether the chat is on a push channel (Telegram or Zalo). */
    readonly is_push: boolean | null
}

/** Finds the id of the customer that owns a lead's contact, or undefined. */
type OwnerOf = (lead: LeadLinkSource) => string | undefined

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
        const ownerOf = await this.ownersOf(manager, workspaceId, leads)
        const links = leads.flatMap((lead) => {
            const customerId = ownerOf(lead)
            return customerId === undefined ? [] : [{ customer_id: customerId, ref: lead.id }]
        })
        const linked = await this.writeLinks(manager, workspaceId, "lead", links)
        await this.linkConversations(manager, workspaceId)
        await this.linkChannels(manager, workspaceId)
        return linked
    }

    /** How many of the customers have a chat that staff do not handle. */
    async countReachable(workspaceId: string, customerIds: ReadonlyArray<string>): Promise<number> {
        if (customerIds.length === 0) return 0
        const row = await this.entityManager
            .createQueryBuilder(LoyaltyCustomerLinkEntity, "l")
            .select("count(DISTINCT l.customerId)::int", "total")
            .innerJoin(
                "agent_conversations",
                "c",
                "c.workspace_id = l.workspace_id AND c.kind = 'customer' AND c.handled_by IS NULL AND ((l.kind = 'conversation' AND c.id::text = l.ref) OR (l.kind = 'lead' AND c.lead_id::text = l.ref))",
            )
            .where("l.workspaceId = :workspaceId AND l.customerId = ANY(:customerIds)", {
                workspaceId,
                customerIds: [...customerIds],
            })
            .getRawOne<{ total: number }>()
        return row === undefined ? 0 : row.total
    }

    /** The chat to send a customer a message in, or null when the customer has none. */
    async pushConversation(workspaceId: string, customerId: string): Promise<PushTarget> {
        const row = await this.entityManager
            .createQueryBuilder(LoyaltyCustomerLinkEntity, "l")
            .select("c.id", "id")
            .addSelect("c.channel", "channel")
            .addSelect("(c.channel IN ('telegram', 'zalo'))", "is_push")
            .innerJoin(
                "agent_conversations",
                "c",
                "c.workspace_id = l.workspace_id AND c.kind = 'customer' AND ((l.kind = 'conversation' AND c.id::text = l.ref) OR (l.kind = 'lead' AND c.lead_id::text = l.ref))",
            )
            .where("l.workspaceId = :workspaceId AND l.customerId = :customerId", { workspaceId, customerId })
            .orderBy("is_push", "DESC")
            .addOrderBy("c.created_at", "DESC")
            .limit(1)
            .getRawOne<PushConversationRaw>()
        return row === undefined ? null : { id: row.id, channel: row.channel }
    }

    /** The member behind a chat, only through what NIVO already links to it: a stranger who types a phone number learns nothing. */
    async customerOfChat(ref: ChatCustomerRef): Promise<ChatCustomerId> {
        const account =
            ref.externalId === null || ref.externalId === "" ? null : `${ref.channel}:${accountIdOf(ref.externalId)}`
        const linked = await this.entityManager
            .createQueryBuilder(LoyaltyCustomerLinkEntity, "l")
            .select("l.customerId", "customer_id")
            .addSelect("CASE l.kind WHEN 'conversation' THEN 0 WHEN 'lead' THEN 1 ELSE 2 END", "rank")
            .where(
                "l.workspaceId = :workspaceId AND ((l.kind = 'conversation' AND l.ref = :conversationId) OR (l.kind = 'lead' AND l.ref = :leadId) OR (l.kind = 'channel' AND l.ref = :account))",
                { workspaceId: ref.workspaceId, conversationId: ref.conversationId, leadId: ref.leadId, account },
            )
            .limit(CHAT_LOOKUP_LIMIT)
            .getRawMany<RankedCustomerRaw>()
        const contact = ref.leadId === null ? [] : await this.customersOfLead(ref.workspaceId, ref.leadId)
        const nearest = [...linked, ...contact].sort((first, second) => first.rank - second.rank)[0]
        return nearest?.customer_id ?? null
    }

    /** The customers whose phone or email is the lead's own, the phone match ranked first. */
    private customersOfLead(workspaceId: string, leadId: string): Promise<Array<RankedCustomerRaw>> {
        return this.entityManager
            .createQueryBuilder()
            .select("c.id", "customer_id")
            .addSelect("CASE WHEN c.phone = ld.phone THEN 3 ELSE 4 END", "rank")
            .from("public.leads", "ld")
            .innerJoin(
                "loyalty_customers",
                "c",
                "c.workspace_id = ld.workspace_id AND ((ld.phone IS NOT NULL AND c.phone = ld.phone) OR (ld.email IS NOT NULL AND c.email = lower(ld.email)))",
            )
            .where("ld.workspace_id = :workspaceId AND ld.id = :leadId", { workspaceId, leadId })
            .limit(CHAT_LOOKUP_LIMIT)
            .getRawMany<RankedCustomerRaw>()
    }

    /** Finds the customer that owns the contact of each lead: by the phone when the lead has one, else by the email. */
    private async ownersOf(
        manager: EntityManager,
        workspaceId: string,
        leads: ReadonlyArray<LeadLinkSource>,
    ): Promise<OwnerOf> {
        const phones = leads.flatMap((lead) => (lead.phone === null ? [] : [lead.phone]))
        const emails = leads.flatMap((lead) => (lead.phone === null && lead.email !== null ? [lead.email] : []))
        const customers = await manager
            .createQueryBuilder()
            .select("c.id", "id")
            .addSelect("c.phone", "phone")
            .addSelect("c.email", "email")
            .from("public.loyalty_customers", "c")
            .where("c.workspace_id = :workspaceId AND (c.phone = ANY(:phones) OR c.email = ANY(:emails))", {
                workspaceId,
                phones,
                emails,
            })
            .limit(leads.length * 2)
            .getRawMany<CustomerContactRaw>()
        const byPhone = new Map<string, string>()
        const byEmail = new Map<string, string>()
        for (const customer of customers) {
            if (customer.phone !== null) byPhone.set(customer.phone, customer.id)
            if (customer.email !== null) byEmail.set(customer.email, customer.id)
        }
        return (lead) => {
            if (lead.phone !== null) return byPhone.get(lead.phone)
            return lead.email === null ? undefined : byEmail.get(lead.email)
        }
    }

    /** Links every customer to the customer conversations of the leads it is linked to. */
    private async linkConversations(manager: EntityManager, workspaceId: string): Promise<void> {
        const pairs = await manager
            .createQueryBuilder(LoyaltyCustomerLinkEntity, "l")
            .select("l.customerId", "customer_id")
            .addSelect("c.id::text", "ref")
            .distinct(true)
            .innerJoin(
                "agent_conversations",
                "c",
                "c.workspace_id = l.workspace_id AND c.lead_id::text = l.ref AND c.kind = 'customer'",
            )
            .where("l.workspaceId = :workspaceId AND l.kind = 'lead'", { workspaceId })
            .limit(DERIVED_LIMIT)
            .getRawMany<DerivedLinkRaw>()
        await this.writeLinks(manager, workspaceId, "conversation", pairs)
    }

    /** Links every customer to the chat accounts (channel and account) of the conversations it is linked to. */
    private async linkChannels(manager: EntityManager, workspaceId: string): Promise<void> {
        const pairs = await manager
            .createQueryBuilder(LoyaltyCustomerLinkEntity, "l")
            .select("l.customerId", "customer_id")
            .addSelect("c.channel || ':' || split_part(c.external_id, ':', 1)", "ref")
            .distinct(true)
            .innerJoin(
                "agent_conversations",
                "c",
                "c.workspace_id = l.workspace_id AND c.id::text = l.ref AND c.kind = 'customer'",
            )
            .where(
                "l.workspaceId = :workspaceId AND l.kind = 'conversation' AND c.channel IS NOT NULL AND c.external_id IS NOT NULL",
                { workspaceId },
            )
            .limit(DERIVED_LIMIT)
            .getRawMany<DerivedLinkRaw>()
        await this.writeLinks(manager, workspaceId, "channel", pairs)
    }

    /** Writes the links in chunks, moving a link that belonged to another customer; answers how many rows were written. */
    private async writeLinks(
        manager: EntityManager,
        workspaceId: string,
        kind: LoyaltyCustomerLinkKind,
        links: ReadonlyArray<DerivedLinkRaw>,
    ): Promise<number> {
        let written = 0
        const chunks = Array.from({ length: Math.ceil(links.length / WRITE_CHUNK) }, (_, index) =>
            links.slice(index * WRITE_CHUNK, (index + 1) * WRITE_CHUNK),
        )
        await eachInOrder(chunks, async (chunk) => {
            const result = await manager
                .createQueryBuilder(LoyaltyCustomerLinkEntity, "lcl")
                .insert()
                .values(chunk.map((link) => ({ workspaceId, customerId: link.customer_id, kind, ref: link.ref })))
                .orUpdate(["customer_id"], ["workspace_id", "kind", "ref"])
                .returning("id")
                .execute()
            written += (result.raw as Array<unknown>).length
        })
        return written
    }
}

/** Removes a message suffix only from the final line of the external identity. */
const accountIdOf = (value: string): string => {
    const lineStart =
        Math.max(value.lastIndexOf("\n"), value.lastIndexOf("\r"), value.lastIndexOf(" "), value.lastIndexOf(" ")) + 1
    const separator = value.indexOf(":", lineStart)
    return separator < 0 ? value : value.slice(0, separator)
}
