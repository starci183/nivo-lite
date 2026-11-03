import {
    NODE_ROWS_MAX,
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

    it("admits a conversation id and a text, and refuses anything else", () => {
        expect(channelSendSchema.safeParse({ conversationId: "c", text: "t" }).success).toBe(true)
        expect(channelSendSchema.safeParse({ conversationId: "", text: "t" }).success).toBe(false)
        expect(channelSendSchema.safeParse({ conversationId: "c" }).success).toBe(false)
    })
})
