import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { AgentConversationReadService } from "@modules/domain/agent-conversations"
import type { CustomerChat } from "@modules/domain/agent-conversations"
import { LeadReadService } from "@modules/domain/leads"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { ChatCustomerId, ChatCustomerRef, LeadLinkSource, PushTarget } from "./loyalty-customer-links.contracts"
import { LoyaltyCustomerLinkEntity } from "./persistence/entities"
import type { LoyaltyCustomerLinkKind } from "./persistence/entities"

/** The most links one statement writes. */
const WRITE_CHUNK = 1000

/** The most links one derived pass (conversations, chat accounts) reads and writes. */
const DERIVED_LIMIT = 5000

/** The most rows one chat lookup reads from each source: a chat has few links, and a lead matches at most two customers. */
const CHAT_LOOKUP_LIMIT = 10

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

/** Finds the id of the customer that owns a lead's contact, or undefined. */
type OwnerOf = (lead: LeadLinkSource) => string | undefined

@Injectable()
/** Ties customers to the leads, conversations and chat accounts that already exist, without touching those tables. */
export class LoyaltyCustomerLinksService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly chats: AgentConversationReadService,
        private readonly leads: LeadReadService,
        private readonly customers: LoyaltyCustomersService,
    ) {}

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
        const links = await this.chatLinksOf(workspaceId, customerIds)
        const chats = await this.chats.customerChatsOf(workspaceId, refsOf(links))
        const reachable = new Set(chats.filter((chat) => chat.handledBy === null).flatMap(chatRefs))
        return new Set(
            links.filter((link) => reachable.has(refKey(link.kind, link.ref))).map((link) => link.customerId),
        ).size
    }

    /** The chat to send a customer a message in, or null when the customer has none. */
    async pushConversation(workspaceId: string, customerId: string): Promise<PushTarget> {
        const links = await this.chatLinksOf(workspaceId, [customerId])
        const chats = await this.chats.customerChatsOf(workspaceId, refsOf(links))
        const linked = new Set(links.map((link) => refKey(link.kind, link.ref)))
        const best = chats
            .filter((chat) => chatRefs(chat).some((key) => linked.has(key)))
            .sort((first, second) => Number(isPush(second)) - Number(isPush(first)))[0]
        return best === undefined ? null : { id: best.id, channel: best.channel }
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
    private async customersOfLead(workspaceId: string, leadId: string): Promise<Array<RankedCustomerRaw>> {
        const lead = await this.leads.contactOf(workspaceId, leadId)
        if (lead === null) return []
        const matches = await this.customers.contactsMatching(
            this.entityManager,
            workspaceId,
            {
                phones: lead.phone === null ? [] : [lead.phone],
                emails: lead.email === null ? [] : [lead.email.toLowerCase()],
            },
            CHAT_LOOKUP_LIMIT,
        )
        return matches.map((customer) => ({ customer_id: customer.id, rank: customer.phone === lead.phone ? 3 : 4 }))
    }

    /** The conversation and lead links of the customers, the references their chats are found by. */
    private chatLinksOf(
        workspaceId: string,
        customerIds: ReadonlyArray<string>,
    ): Promise<Array<LoyaltyCustomerLinkEntity>> {
        return this.entityManager.find(LoyaltyCustomerLinkEntity, {
            where: { workspaceId, customerId: In([...customerIds]), kind: In(["conversation", "lead"]) },
            take: DERIVED_LIMIT,
        })
    }

    /** Finds the customer that owns the contact of each lead: by the phone when the lead has one, else by the email. */
    private async ownersOf(
        manager: EntityManager,
        workspaceId: string,
        leads: ReadonlyArray<LeadLinkSource>,
    ): Promise<OwnerOf> {
        const phones = leads.flatMap((lead) => (lead.phone === null ? [] : [lead.phone]))
        const emails = leads.flatMap((lead) => (lead.phone === null && lead.email !== null ? [lead.email] : []))
        const customers = await this.customers.contactsMatching(
            manager,
            workspaceId,
            { phones, emails },
            leads.length * 2,
        )
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
        const leadLinks = await manager.find(LoyaltyCustomerLinkEntity, {
            where: { workspaceId, kind: "lead" },
            take: DERIVED_LIMIT,
        })
        const chats = await this.chats.customerChatsOf(
            workspaceId,
            { conversationIds: [], leadIds: leadLinks.map((link) => link.ref) },
            manager,
        )
        const pairs = distinctPairs(
            leadLinks.flatMap((link) =>
                chats
                    .filter((chat) => chat.leadId === link.ref)
                    .map((chat) => ({ customer_id: link.customerId, ref: chat.id })),
            ),
        )
        await this.writeLinks(manager, workspaceId, "conversation", pairs)
    }

    /** Links every customer to the chat accounts (channel and account) of the conversations it is linked to. */
    private async linkChannels(manager: EntityManager, workspaceId: string): Promise<void> {
        const chatLinks = await manager.find(LoyaltyCustomerLinkEntity, {
            where: { workspaceId, kind: "conversation" },
            take: DERIVED_LIMIT,
        })
        const chats = await this.chats.customerChatsOf(
            workspaceId,
            { conversationIds: chatLinks.map((link) => link.ref), leadIds: [] },
            manager,
        )
        const pairs = distinctPairs(
            chatLinks.flatMap((link) =>
                chats.flatMap((chat) =>
                    chat.id === link.ref && chat.externalId !== null
                        ? [
                              {
                                  customer_id: link.customerId,
                                  ref: `${chat.channel}:${chat.externalId.split(":", 1).join("")}`,
                              },
                          ]
                        : [],
                ),
            ),
        )
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

/** The key one link reference is looked up by. */
const refKey = (kind: LoyaltyCustomerLinkKind, ref: string): string => `${kind}:${ref}`

/** The keys a chat is reachable by: its own conversation key and, when it has one, its lead key. */
const chatRefs = (chat: CustomerChat): Array<string> => [
    refKey("conversation", chat.id),
    ...(chat.leadId === null ? [] : [refKey("lead", chat.leadId)]),
]

/** The references that find the chats the links point at. */
const refsOf = (links: ReadonlyArray<LoyaltyCustomerLinkEntity>) => ({
    conversationIds: links.filter((link) => link.kind === "conversation").map((link) => link.ref),
    leadIds: links.filter((link) => link.kind === "lead").map((link) => link.ref),
})

/** Whether the chat is on a push channel (Telegram or Zalo). */
const isPush = (chat: CustomerChat): boolean => chat.channel === "telegram" || chat.channel === "zalo"

/** The pairs without repeats, in first-seen order. */
const distinctPairs = (pairs: ReadonlyArray<DerivedLinkRaw>): Array<DerivedLinkRaw> => [
    ...new Map(pairs.map((pair) => [`${pair.customer_id}|${pair.ref}`, pair])).values(),
]

/** Removes a message suffix only from the final line of the external identity. */
const accountIdOf = (value: string): string => {
    const lineStart =
        Math.max(value.lastIndexOf("\n"), value.lastIndexOf("\r"), value.lastIndexOf(" "), value.lastIndexOf(" ")) + 1
    const separator = value.indexOf(":", lineStart)
    return separator < 0 ? value : value.slice(0, separator)
}
