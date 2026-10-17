import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { ChatCustomerRef } from "./loyalty-customer-links.contracts"
import { LoyaltyCustomerLinksService } from "./loyalty-customer-links.service"
import {
    COUNT_REACHABLE,
    SELECT_CHAT_CUSTOMER,
    SELECT_PUSH_CONVERSATION,
    UPSERT_CHANNEL_LINKS,
    UPSERT_CONVERSATION_LINKS,
    UPSERT_LEAD_LINKS,
} from "./persistence/loyalty-customer-links.sql"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [LoyaltyCustomerLinksService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(LoyaltyCustomerLinksService)
}

describe("LoyaltyCustomerLinksService / linkLeads", () => {
    it("links leads, then their conversations and chat accounts, and counts the leads", async () => {
        const manager = mockEntityManager({
            query: [
                [UPSERT_LEAD_LINKS, [{ id: "k1" }, { id: "k2" }]],
                [UPSERT_CONVERSATION_LINKS, []],
                [UPSERT_CHANNEL_LINKS, []],
            ],
        })
        const links = await build(mockEntityManager())

        await expect(
            links.linkLeads(manager, "ws-1", [
                { id: "l1", phone: "84912345678", email: null },
                { id: "l2", phone: null, email: "b@x.com" },
            ]),
        ).resolves.toBe(2)

        expect(manager.query).toHaveBeenCalledWith(UPSERT_LEAD_LINKS, [
            "ws-1",
            JSON.stringify([
                { lead_id: "l1", phone: "84912345678", email: null },
                { lead_id: "l2", phone: null, email: "b@x.com" },
            ]),
        ])
        expect(manager.query).toHaveBeenCalledWith(UPSERT_CONVERSATION_LINKS, ["ws-1"])
        expect(manager.query).toHaveBeenCalledWith(UPSERT_CHANNEL_LINKS, ["ws-1"])
    })

    it("writes nothing for no leads", async () => {
        const manager = mockEntityManager()
        const links = await build(mockEntityManager())

        await expect(links.linkLeads(manager, "ws-1", [])).resolves.toBe(0)
    })
})

describe("LoyaltyCustomerLinksService / countReachable", () => {
    it("counts the customers with a chat staff do not handle", async () => {
        const links = await build(mockEntityManager({ query: [COUNT_REACHABLE, [{ total: 3 }]] }))

        await expect(links.countReachable("ws-1", ["c1", "c2"])).resolves.toBe(3)
    })

    it("is zero for no customers and when the count answers no row", async () => {
        const none = await build(mockEntityManager({ query: [COUNT_REACHABLE, []] }))

        await expect(none.countReachable("ws-1", [])).resolves.toBe(0)
        await expect(none.countReachable("ws-1", ["c1"])).resolves.toBe(0)
    })
})

describe("LoyaltyCustomerLinksService / pushConversation", () => {
    it("answers the newest chat of the customer, or null", async () => {
        const found = await build(
            mockEntityManager({ query: [SELECT_PUSH_CONVERSATION, [{ id: "v1", channel: "telegram" }]] }),
        )
        const none = await build(mockEntityManager({ query: [SELECT_PUSH_CONVERSATION, []] }))

        await expect(found.pushConversation("ws-1", "c1")).resolves.toEqual({ id: "v1", channel: "telegram" })
        await expect(none.pushConversation("ws-1", "c1")).resolves.toBeNull()
    })
})

describe("LoyaltyCustomerLinksService / customerOfChat", () => {
    const refOf = (externalId: string | null): ChatCustomerRef => ({
        workspaceId: "ws-1",
        conversationId: "v1",
        leadId: "l1",
        channel: "telegram",
        externalId,
    })
    it("finds the linked customer through the conversation, lead and channel account", async () => {
        const manager = mockEntityManager({ query: [SELECT_CHAT_CUSTOMER, [{ customer_id: "c1" }]] })
        const links = await build(manager)

        await expect(links.customerOfChat(refOf("123:456:789"))).resolves.toBe("c1")
        expect(manager.query).toHaveBeenCalledWith(SELECT_CHAT_CUSTOMER, ["ws-1", "v1", "l1", "telegram:123"])
    })

    it("preserves an external account without a message suffix", async () => {
        const manager = mockEntityManager({ query: [SELECT_CHAT_CUSTOMER, [{ customer_id: "c1" }]] })
        const links = await build(manager)

        await expect(links.customerOfChat(refOf("123"))).resolves.toBe("c1")
        expect(manager.query).toHaveBeenCalledWith(SELECT_CHAT_CUSTOMER, ["ws-1", "v1", "l1", "telegram:123"])
    })

    it("passes no channel account when the external id is null", async () => {
        const manager = mockEntityManager({ query: [SELECT_CHAT_CUSTOMER, [{ customer_id: "c1" }]] })
        const links = await build(manager)

        await expect(links.customerOfChat(refOf(null))).resolves.toBe("c1")
        expect(manager.query).toHaveBeenCalledWith(SELECT_CHAT_CUSTOMER, ["ws-1", "v1", "l1", null])
    })

    it("passes no channel account when the external id is empty", async () => {
        const manager = mockEntityManager({ query: [SELECT_CHAT_CUSTOMER, [{ customer_id: "c1" }]] })
        const links = await build(manager)

        await expect(links.customerOfChat(refOf(""))).resolves.toBe("c1")
        expect(manager.query).toHaveBeenCalledWith(SELECT_CHAT_CUSTOMER, ["ws-1", "v1", "l1", null])
    })

    it("returns null when no existing link identifies the chat", async () => {
        const manager = mockEntityManager({ query: [SELECT_CHAT_CUSTOMER, []] })
        const links = await build(manager)

        await expect(
            links.customerOfChat({ ...refOf("account:message"), leadId: null, channel: "zalo" }),
        ).resolves.toBeNull()
        expect(manager.query).toHaveBeenCalledWith(SELECT_CHAT_CUSTOMER, ["ws-1", "v1", null, "zalo:account"])
    })
})
