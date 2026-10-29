import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentConversationReadService } from "@modules/domain/agent-conversations"
import type { CustomerChat } from "@modules/domain/agent-conversations"
import { LeadReadService } from "@modules/domain/leads"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { ChatCustomerRef } from "./loyalty-customer-links.contracts"
import { LoyaltyCustomerLinksService } from "./loyalty-customer-links.service"
import { LoyaltyCustomerLinkEntity } from "./persistence/entities"
import type { LoyaltyCustomerLinkKind } from "./persistence/entities"

const build = async (entityManager: MockEntityManager) => {
    const chats = mock<AgentConversationReadService>()
    chats.customerChatsOf.mockResolvedValue([])
    const leads = mock<LeadReadService>()
    leads.contactOf.mockResolvedValue(null)
    const customers = mock<LoyaltyCustomersService>()
    customers.contactsMatching.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyCustomerLinksService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: AgentConversationReadService, useValue: chats },
            { provide: LeadReadService, useValue: leads },
            { provide: LoyaltyCustomersService, useValue: customers },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyCustomerLinksService), chats, leads, customers }
}

const refOf = (externalId: string | null, leadId: string | null = "l1"): ChatCustomerRef => ({
    workspaceId: "ws-1",
    conversationId: "v1",
    leadId,
    channel: "telegram",
    externalId,
})

const linkOf = (customerId: string, kind: LoyaltyCustomerLinkKind, ref: string): LoyaltyCustomerLinkEntity =>
    Object.assign(new LoyaltyCustomerLinkEntity(), { workspaceId: "ws-1", customerId, kind, ref })

const chatOf = (fields: Partial<CustomerChat> & Pick<CustomerChat, "id">): CustomerChat => ({
    leadId: null,
    channel: "website",
    externalId: null,
    handledBy: null,
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
    ...fields,
})

/** A manager whose linked-customer read answers `linked`. */
const chatManager = (linked: ReadonlyArray<unknown>) => {
    const em = mockEntityManager()
    const [links] = queueQueryBuilders(em, [{ getRawMany: linked }])
    return { em, links }
}

describe("LoyaltyCustomerLinksService / linkLeads", () => {
    it("links leads, then their conversations and chat accounts, and counts the leads", async () => {
        const manager = mockEntityManager({ find: [LoyaltyCustomerLinkEntity, []] })
        manager.find
            .mockResolvedValueOnce([linkOf("c1", "lead", "l1")])
            .mockResolvedValueOnce([linkOf("c1", "conversation", "v1")])
        const [leadInsert, conversationInsert, channelInsert] = queueQueryBuilders(manager, [
            { execute: { raw: [{ id: "k1" }, { id: "k2" }] } },
            { execute: { raw: [{ id: "k3" }] } },
            { execute: { raw: [{ id: "k4" }] } },
        ])
        const { service, chats, customers } = await build(mockEntityManager())
        customers.contactsMatching.mockResolvedValue([
            { id: "c1", phone: "84912345678", email: null },
            { id: "c2", phone: null, email: "b@x.com" },
        ])
        chats.customerChatsOf
            .mockResolvedValueOnce([chatOf({ id: "v1", leadId: "l1" }), chatOf({ id: "v1", leadId: "l1" })])
            .mockResolvedValueOnce([
                chatOf({ id: "v1", channel: "telegram", externalId: "123:abc" }),
                chatOf({ id: "v9", channel: "zalo", externalId: null }),
            ])

        await expect(
            service.linkLeads(manager, "ws-1", [
                { id: "l1", phone: "84912345678", email: null },
                { id: "l2", phone: null, email: "b@x.com" },
            ]),
        ).resolves.toBe(2)

        expect(customers.contactsMatching).toHaveBeenCalledWith(
            manager,
            "ws-1",
            { phones: ["84912345678"], emails: ["b@x.com"] },
            4,
        )
        expect(leadInsert?.callsOf("values")).toEqual([
            [
                [
                    { workspaceId: "ws-1", customerId: "c1", kind: "lead", ref: "l1" },
                    { workspaceId: "ws-1", customerId: "c2", kind: "lead", ref: "l2" },
                ],
            ],
        ])
        expect(leadInsert?.callsOf("orUpdate")).toEqual([[["customer_id"], ["workspace_id", "kind", "ref"]]])
        expect(chats.customerChatsOf).toHaveBeenNthCalledWith(
            1,
            "ws-1",
            { conversationIds: [], leadIds: ["l1"] },
            manager,
        )
        expect(manager.find).toHaveBeenNthCalledWith(1, LoyaltyCustomerLinkEntity, {
            where: { workspaceId: "ws-1", kind: "lead" },
            take: 5000,
        })
        expect(conversationInsert?.callsOf("values")).toEqual([
            [[{ workspaceId: "ws-1", customerId: "c1", kind: "conversation", ref: "v1" }]],
        ])
        expect(chats.customerChatsOf).toHaveBeenNthCalledWith(
            2,
            "ws-1",
            { conversationIds: ["v1"], leadIds: [] },
            manager,
        )
        expect(channelInsert?.callsOf("values")).toEqual([
            [[{ workspaceId: "ws-1", customerId: "c1", kind: "channel", ref: "telegram:123" }]],
        ])
    })
})

describe("LoyaltyCustomerLinksService / linkLeads partial", () => {
    it("links only the leads whose contact a customer owns, and writes no derived link when none is found", async () => {
        const manager = mockEntityManager({ find: [LoyaltyCustomerLinkEntity, []] })
        const [leadInsert] = queueQueryBuilders(manager, [{ execute: { raw: [{ id: "k1" }] } }])
        const { service, customers } = await build(mockEntityManager())
        customers.contactsMatching.mockResolvedValue([{ id: "c1", phone: "84912345678", email: "x@x.com" }])

        await expect(
            service.linkLeads(manager, "ws-1", [
                { id: "l1", phone: "84912345678", email: "x@x.com" },
                { id: "l2", phone: "84900000000", email: "y@x.com" },
                { id: "l3", phone: null, email: null },
            ]),
        ).resolves.toBe(1)

        expect(leadInsert?.callsOf("values")).toEqual([
            [[{ workspaceId: "ws-1", customerId: "c1", kind: "lead", ref: "l1" }]],
        ])
        expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it("matches a lead by its email when the lead has no phone", async () => {
        const manager = mockEntityManager({ find: [LoyaltyCustomerLinkEntity, []] })
        queueQueryBuilders(manager, [{ execute: { raw: [{ id: "k1" }] } }])
        const { service, customers } = await build(mockEntityManager())
        customers.contactsMatching.mockResolvedValue([{ id: "c2", phone: null, email: "a@x.com" }])

        await expect(service.linkLeads(manager, "ws-1", [{ id: "l1", phone: null, email: "a@x.com" }])).resolves.toBe(1)
        await expect(service.linkLeads(manager, "ws-1", [{ id: "l1", phone: null, email: null }])).resolves.toBe(0)
    })

    it("writes nothing for no leads", async () => {
        const manager = mockEntityManager()
        const { service } = await build(mockEntityManager())

        await expect(service.linkLeads(manager, "ws-1", [])).resolves.toBe(0)
        expect(manager.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("LoyaltyCustomerLinksService / countReachable", () => {
    it("counts the customers with a chat staff do not handle", async () => {
        const em = mockEntityManager({
            find: [
                LoyaltyCustomerLinkEntity,
                [
                    linkOf("c1", "conversation", "v1"),
                    linkOf("c1", "lead", "l1"),
                    linkOf("c2", "lead", "l2"),
                    linkOf("c3", "conversation", "v3"),
                ],
            ],
        })
        const { service, chats } = await build(em)
        chats.customerChatsOf.mockResolvedValue([
            chatOf({ id: "v1", leadId: "l1" }),
            chatOf({ id: "v2", leadId: "l2", handledBy: "Lan" }),
            chatOf({ id: "v3" }),
        ])

        await expect(service.countReachable("ws-1", ["c1", "c2", "c3"])).resolves.toBe(2)
        expect(em.find).toHaveBeenCalledWith(LoyaltyCustomerLinkEntity, {
            where: { workspaceId: "ws-1", customerId: In(["c1", "c2", "c3"]), kind: In(["conversation", "lead"]) },
            take: 5000,
        })
        expect(chats.customerChatsOf).toHaveBeenCalledWith("ws-1", {
            conversationIds: ["v1", "v3"],
            leadIds: ["l1", "l2"],
        })
    })

    it("is zero for no customers", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.countReachable("ws-1", [])).resolves.toBe(0)
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("LoyaltyCustomerLinksService / pushConversation", () => {
    it("answers the newest chat of the customer, push channels first, or null", async () => {
        const em = mockEntityManager({
            find: [LoyaltyCustomerLinkEntity, [linkOf("c1", "lead", "l1"), linkOf("c1", "conversation", "v1")]],
        })
        const { service, chats } = await build(em)
        chats.customerChatsOf.mockResolvedValueOnce([
            chatOf({ id: "v1", channel: "website" }),
            chatOf({ id: "v2", leadId: "l1", channel: "telegram" }),
            chatOf({ id: "v3", leadId: "l1", channel: "zalo" }),
            chatOf({ id: "v4", leadId: "other", channel: "zalo" }),
        ])

        await expect(service.pushConversation("ws-1", "c1")).resolves.toEqual({ id: "v2", channel: "telegram" })
        await expect(service.pushConversation("ws-1", "c1")).resolves.toBeNull()
    })
})

describe("LoyaltyCustomerLinksService / customerOfChat", () => {
    it("finds the linked customer through the conversation, lead and channel account", async () => {
        const { em, links } = chatManager([{ customer_id: "c1", rank: 0 }])
        const { service } = await build(em)

        await expect(service.customerOfChat(refOf("123:456:789"))).resolves.toBe("c1")
        expect(links?.callsOf("where")).toEqual([
            [
                "l.workspaceId = :workspaceId AND ((l.kind = 'conversation' AND l.ref = :conversationId) OR (l.kind = 'lead' AND l.ref = :leadId) OR (l.kind = 'channel' AND l.ref = :account))",
                { workspaceId: "ws-1", conversationId: "v1", leadId: "l1", account: "telegram:123" },
            ],
        ])
    })

    it.each([
        ["first:suffix\nlast:message", "first:suffix\nlast"],
        ["account:message\n", "account:message\n"],
        ["a" + ":".repeat(20000), "a"],
    ])("keeps the final-line suffix boundary for %s", async (externalId, account) => {
        const { em, links } = chatManager([{ customer_id: "c1", rank: 2 }])
        const { service } = await build(em)

        await expect(service.customerOfChat(refOf(externalId))).resolves.toBe("c1")
        expect(links?.callsOf("where")[0]?.[1]).toEqual({
            workspaceId: "ws-1",
            conversationId: "v1",
            leadId: "l1",
            account: "telegram:" + account,
        })
    })

    it("preserves an external account without a message suffix", async () => {
        const { em, links } = chatManager([{ customer_id: "c1", rank: 2 }])
        const { service } = await build(em)

        await expect(service.customerOfChat(refOf("123"))).resolves.toBe("c1")
        expect(links?.callsOf("where")[0]?.[1]).toMatchObject({ account: "telegram:123" })
    })

    it.each([null, ""])("passes no channel account when the external id is %p", async (externalId) => {
        const { em, links } = chatManager([{ customer_id: "c1", rank: 0 }])
        const { service } = await build(em)

        await expect(service.customerOfChat(refOf(externalId))).resolves.toBe("c1")
        expect(links?.callsOf("where")[0]?.[1]).toMatchObject({ account: null })
    })
})

describe("LoyaltyCustomerLinksService / customerOfChat ranking", () => {
    const LEAD = { id: "l1", contact_name: "An", phone: "84912345678", email: "A@X.com" }
    const MATCHES = [
        { id: "by-email", phone: null, email: "a@x.com" },
        { id: "by-phone", phone: "84912345678", email: null },
    ]

    it("prefers the closest link, then the phone match over the email match of the lead", async () => {
        const { em } = chatManager([{ customer_id: "by-channel", rank: 2 }])
        const { em: second } = chatManager([])
        const first = await build(em)
        const other = await build(second)
        for (const built of [first, other]) {
            built.leads.contactOf.mockResolvedValue(LEAD)
            built.customers.contactsMatching.mockResolvedValue(MATCHES)
        }

        await expect(first.service.customerOfChat(refOf("123"))).resolves.toBe("by-channel")
        await expect(other.service.customerOfChat(refOf("123"))).resolves.toBe("by-phone")
        expect(other.customers.contactsMatching).toHaveBeenCalledWith(
            second,
            "ws-1",
            { phones: ["84912345678"], emails: ["a@x.com"] },
            10,
        )
    })

    it("matches a lead that has only a phone, or only an email, or neither", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [] }])
        const { service, leads, customers } = await build(em)
        leads.contactOf.mockResolvedValueOnce({ ...LEAD, email: null })

        await service.customerOfChat(refOf("1"))
        leads.contactOf.mockResolvedValueOnce({ ...LEAD, phone: null })
        await service.customerOfChat(refOf("1"))

        expect(customers.contactsMatching).toHaveBeenNthCalledWith(
            1,
            em,
            "ws-1",
            { phones: ["84912345678"], emails: [] },
            10,
        )
        expect(customers.contactsMatching).toHaveBeenNthCalledWith(
            2,
            em,
            "ws-1",
            { phones: [], emails: ["a@x.com"] },
            10,
        )
    })

    it("returns null when no existing link identifies the chat and does not read leads without one", async () => {
        const { em, links } = chatManager([])
        const { service, leads } = await build(em)

        await expect(service.customerOfChat({ ...refOf("account:message", null), channel: "zalo" })).resolves.toBeNull()
        expect(links?.callsOf("where")[0]?.[1]).toEqual({
            workspaceId: "ws-1",
            conversationId: "v1",
            leadId: null,
            account: "zalo:account",
        })
        expect(leads.contactOf).not.toHaveBeenCalled()
    })

    it("reads no customers for a lead the workspace does not have", async () => {
        const { em } = chatManager([])
        const { service, customers } = await build(em)

        await expect(service.customerOfChat(refOf("123"))).resolves.toBeNull()
        expect(customers.contactsMatching).not.toHaveBeenCalled()
    })
})
