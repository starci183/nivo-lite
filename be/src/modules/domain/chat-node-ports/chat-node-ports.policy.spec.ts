import {
    NODE_ROWS_MAX,
    messageIdOf,
    placeholderRecipient,
    recipientRefused,
    recipientLinked,
    cutFields,
    limitOf,
    matchesWhere,
    statusOf,
    textWithLinks,
    turnConversationOf,
} from "./chat-node-ports.policy"
import { channelSendSchema } from "./chat-node-ports.schema"

const TURN = {
    turnId: "t",
    workspaceId: "ws-1",
    agentId: "a-1",
    subject: null,
    conversationId: "c1",
    locale: "vi" as const,
}

describe("chat-node-ports policy", () => {
    it("keeps a limit between one and the most a read answers", () => {
        expect(limitOf({ fields: ["id"] })).toBe(NODE_ROWS_MAX)
        expect(limitOf({ fields: ["id"], limit: 0 })).toBe(1)
        expect(limitOf({ fields: ["id"], limit: 7 })).toBe(7)
        expect(limitOf({ fields: ["id"], limit: 9999 })).toBe(NODE_ROWS_MAX)
    })

    it("cuts a row to the asked fields and matches a where", () => {
        expect(cutFields({ id: "1", body: "x", secret: "s" }, ["id", "body"])).toEqual({ id: "1", body: "x" })
        expect(matchesWhere({ a: 1, b: 2 }, { a: 1 })).toBe(true)
        expect(matchesWhere({ a: 1 }, { a: 2 })).toBe(false)
        expect(matchesWhere({ a: 1 }, undefined)).toBe(true)
    })

    it("names who holds the conversation", () => {
        expect(statusOf(null)).toBe("agent")
        expect(statusOf("Lan")).toBe("with_person")
    })

    it("puts attachments as links under the text", () => {
        expect(textWithLinks({ conversationId: "c", text: "Hi" })).toBe("Hi")
        expect(
            textWithLinks({ conversationId: "c", text: "Hi", attachments: [{ url: "https://x/y", name: "Menu" }] }),
        ).toBe("Hi\nMenu: https://x/y")
    })

    it("reaches only the conversation the turn serves", () => {
        expect(turnConversationOf(TURN, undefined)).toBe("c1")
        expect(turnConversationOf(TURN, "c1")).toBe("c1")
        expect(turnConversationOf(TURN, "c2")).toBeNull()
        expect(turnConversationOf({ ...TURN, conversationId: null }, undefined)).toBeNull()
    })

    it("needs a customer id and a connection to push to, except on the website chat", () => {
        expect(recipientLinked({ channel: "website", externalId: null, connectionId: null })).toBe(true)
        expect(recipientLinked({ channel: "zalo", externalId: "1234567890", connectionId: "k1" })).toBe(true)
        expect(recipientLinked({ channel: "zalo", externalId: null, connectionId: "k1" })).toBe(false)
        expect(recipientLinked({ channel: "zalo", externalId: "u1", connectionId: null })).toBe(false)
    })

    it("knows a placeholder Zalo sender by its id not being digits, archive suffix aside", () => {
        expect(placeholderRecipient({ channel: "zalo", externalId: "1234567890123456789" })).toBe(false)
        expect(placeholderRecipient({ channel: "zalo", externalId: "1234567890:1730000000" })).toBe(false)
        expect(placeholderRecipient({ channel: "zalo", externalId: "import-dinh" })).toBe(true)
        expect(placeholderRecipient({ channel: "zalo", externalId: ":1730" })).toBe(true)
        expect(placeholderRecipient({ channel: "zalo", externalId: null })).toBe(false)
        expect(placeholderRecipient({ channel: "telegram", externalId: "import-dinh" })).toBe(false)
    })

    it("names the Zalo refusals that mean the recipient cannot be reached", () => {
        expect(recipientRefused("zalo_recipient")).toBe(true)
        expect(recipientRefused("zalo_unfollowed")).toBe(true)
        expect(recipientRefused("zalo_quota")).toBe(false)
        expect(recipientRefused(null)).toBe(false)
    })

    it("derives one uuid per send key, the same every time", () => {
        expect(messageIdOf("run:1")).toBe(messageIdOf("run:1"))
        expect(messageIdOf("run:1")).not.toBe(messageIdOf("run:2"))
        expect(messageIdOf("run:1")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
    })

    it("admits a conversation id and a text, and refuses anything else", () => {
        expect(channelSendSchema.safeParse({ conversationId: "c", text: "t" }).success).toBe(true)
        expect(channelSendSchema.safeParse({ conversationId: "", text: "t" }).success).toBe(false)
        expect(channelSendSchema.safeParse({ conversationId: "c" }).success).toBe(false)
    })
})
