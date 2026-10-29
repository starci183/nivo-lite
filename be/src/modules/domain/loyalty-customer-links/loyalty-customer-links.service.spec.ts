import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { ChatCustomerRef } from "./loyalty-customer-links.contracts"
import { LoyaltyCustomerLinksService } from "./loyalty-customer-links.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [LoyaltyCustomerLinksService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(LoyaltyCustomerLinksService)
}

const refOf = (externalId: string | null): ChatCustomerRef => ({
    workspaceId: "ws-1",
    conversationId: "v1",
    leadId: "l1",
    channel: "telegram",
    externalId,
})

/** A manager whose linked-customer read answers `linked` and whose lead-contact read answers `contact`. */
const chatManager = (linked: ReadonlyArray<unknown>, contact: ReadonlyArray<unknown> = []) => {
    const em = mockEntityManager()
    const [links] = queueQueryBuilders(em, [{ getRawMany: linked }, { getRawMany: contact }])
    return { em, links }
}

describe("LoyaltyCustomerLinksService / linkLeads", () => {
    it("links leads, then their conversations and chat accounts, and counts the leads", async () => {
        const manager = mockEntityManager()
        const [owners, leadInsert, conversations, conversationInsert, channels, channelInsert] = queueQueryBuilders(
            manager,
            [
                {
                    getRawMany: [
                        { id: "c1", phone: "84912345678", email: null },
                        { id: "c2", phone: null, email: "b@x.com" },
                    ],
                },
                { execute: { raw: [{ id: "k1" }, { id: "k2" }] } },
                { getRawMany: [{ customer_id: "c1", ref: "v1" }] },
                { execute: { raw: [{ id: "k3" }] } },
                { getRawMany: [{ customer_id: "c1", ref: "telegram:123" }] },
                { execute: { raw: [{ id: "k4" }] } },
            ],
        )
        const links = await build(mockEntityManager())

        await expect(
            links.linkLeads(manager, "ws-1", [
                { id: "l1", phone: "84912345678", email: null },
                { id: "l2", phone: null, email: "b@x.com" },
            ]),
        ).resolves.toBe(2)

        expect(owners?.callsOf("where")).toEqual([
            [
                "c.workspace_id = :workspaceId AND (c.phone = ANY(:phones) OR c.email = ANY(:emails))",
                { workspaceId: "ws-1", phones: ["84912345678"], emails: ["b@x.com"] },
            ],
        ])
        expect(owners?.callsOf("limit")).toEqual([[4]])
        expect(leadInsert?.callsOf("insert")).toEqual([[]])
        expect(leadInsert?.callsOf("values")).toEqual([
            [
                [
                    { workspaceId: "ws-1", customerId: "c1", kind: "lead", ref: "l1" },
                    { workspaceId: "ws-1", customerId: "c2", kind: "lead", ref: "l2" },
                ],
            ],
        ])
        expect(leadInsert?.callsOf("orUpdate")).toEqual([[["customer_id"], ["workspace_id", "kind", "ref"]]])
        expect(conversations?.callsOf("limit")).toEqual([[5000]])
        expect(conversationInsert?.callsOf("values")).toEqual([
            [[{ workspaceId: "ws-1", customerId: "c1", kind: "conversation", ref: "v1" }]],
        ])
        expect(channels?.callsOf("limit")).toEqual([[5000]])
        expect(channelInsert?.callsOf("values")).toEqual([
            [[{ workspaceId: "ws-1", customerId: "c1", kind: "channel", ref: "telegram:123" }]],
        ])
    })
})

describe("LoyaltyCustomerLinksService / linkLeads partial", () => {
    it("links only the leads whose contact a customer owns, and writes no derived link when none is found", async () => {
        const manager = mockEntityManager()
        const [, leadInsert] = queueQueryBuilders(manager, [
            { getRawMany: [{ id: "c1", phone: "84912345678", email: "x@x.com" }] },
            { execute: { raw: [{ id: "k1" }] } },
            { getRawMany: [] },
            { getRawMany: [] },
        ])
        const links = await build(mockEntityManager())

        await expect(
            links.linkLeads(manager, "ws-1", [
                { id: "l1", phone: "84912345678", email: "x@x.com" },
                { id: "l2", phone: "84900000000", email: "y@x.com" },
                { id: "l3", phone: null, email: null },
            ]),
        ).resolves.toBe(1)

        expect(leadInsert?.callsOf("values")).toEqual([
            [[{ workspaceId: "ws-1", customerId: "c1", kind: "lead", ref: "l1" }]],
        ])
        expect(manager.createQueryBuilder).toHaveBeenCalledTimes(4)
    })

    it("writes nothing for no leads", async () => {
        const manager = mockEntityManager()
        const links = await build(mockEntityManager())

        await expect(links.linkLeads(manager, "ws-1", [])).resolves.toBe(0)
        expect(manager.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("LoyaltyCustomerLinksService / countReachable", () => {
    it("counts the customers with a chat staff do not handle", async () => {
        const em = mockEntityManager()
        const [count] = queueQueryBuilders(em, [{ getRawOne: { total: 3 } }])
        const links = await build(em)

        await expect(links.countReachable("ws-1", ["c1", "c2"])).resolves.toBe(3)
        expect(count?.callsOf("where")).toEqual([
            [
                "l.workspaceId = :workspaceId AND l.customerId = ANY(:customerIds)",
                { workspaceId: "ws-1", customerIds: ["c1", "c2"] },
            ],
        ])
    })

    it("is zero for no customers and when the count answers no row", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawOne: undefined }])
        const none = await build(em)

        await expect(none.countReachable("ws-1", [])).resolves.toBe(0)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        await expect(none.countReachable("ws-1", ["c1"])).resolves.toBe(0)
    })
})

describe("LoyaltyCustomerLinksService / pushConversation", () => {
    it("answers the newest chat of the customer, push channels first, or null", async () => {
        const em = mockEntityManager()
        const [found] = queueQueryBuilders(em, [
            { getRawOne: { id: "v1", channel: "telegram", is_push: true } },
            { getRawOne: undefined },
        ])
        const links = await build(em)

        await expect(links.pushConversation("ws-1", "c1")).resolves.toEqual({ id: "v1", channel: "telegram" })
        await expect(links.pushConversation("ws-1", "c1")).resolves.toBeNull()
        expect(found?.callsOf("orderBy")).toEqual([["is_push", "DESC"]])
        expect(found?.callsOf("addOrderBy")).toEqual([["c.created_at", "DESC"]])
        expect(found?.callsOf("limit")).toEqual([[1]])
    })
})

describe("LoyaltyCustomerLinksService / customerOfChat", () => {
    it("finds the linked customer through the conversation, lead and channel account", async () => {
        const { em, links } = chatManager([{ customer_id: "c1", rank: 0 }])
        const service = await build(em)

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
        const service = await build(em)

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
        const service = await build(em)

        await expect(service.customerOfChat(refOf("123"))).resolves.toBe("c1")
        expect(links?.callsOf("where")[0]?.[1]).toMatchObject({ account: "telegram:123" })
    })

    it.each([null, ""])("passes no channel account when the external id is %p", async (externalId) => {
        const { em, links } = chatManager([{ customer_id: "c1", rank: 0 }])
        const service = await build(em)

        await expect(service.customerOfChat(refOf(externalId))).resolves.toBe("c1")
        expect(links?.callsOf("where")[0]?.[1]).toMatchObject({ account: null })
    })
})

describe("LoyaltyCustomerLinksService / customerOfChat ranking", () => {
    it("prefers the closest link, then the phone match over the email match of the lead", async () => {
        const contact = [
            { customer_id: "by-email", rank: 4 },
            { customer_id: "by-phone", rank: 3 },
        ]
        const { em } = chatManager([{ customer_id: "by-channel", rank: 2 }], contact)
        const { em: second } = chatManager([], contact)

        await expect((await build(em)).customerOfChat(refOf("123"))).resolves.toBe("by-channel")
        await expect((await build(second)).customerOfChat(refOf("123"))).resolves.toBe("by-phone")
    })

    it("returns null when no existing link identifies the chat and does not read leads without one", async () => {
        const em = mockEntityManager()
        const [links] = queueQueryBuilders(em, [{ getRawMany: [] }])
        const service = await build(em)

        await expect(
            service.customerOfChat({ ...refOf("account:message"), leadId: null, channel: "zalo" }),
        ).resolves.toBeNull()
        expect(links?.callsOf("where")[0]?.[1]).toEqual({
            workspaceId: "ws-1",
            conversationId: "v1",
            leadId: null,
            account: "zalo:account",
        })
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })
})
