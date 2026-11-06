import { Test } from "@nestjs/testing"
import {
    NODE_ROWS_MAX,
    placeholderRecipient,
    recipientRefused,
    recipientLinked,
    cutFields,
    limitOf,
    matchesWhere,
    handledByOf,
    textWithLinks,
} from "./chat-node-ports.policy"
import { channelSendSchema, proposeReplySchema } from "./chat-node-ports.schema"

const SUBJECT = Symbol("chat-node-ports.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    placeholderRecipient,
                    recipientRefused,
                    recipientLinked,
                    cutFields,
                    limitOf,
                    matchesWhere,
                    textWithLinks,
                    handledByOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./chat-node-ports.policy")>(SUBJECT)
}

describe("chat-node-ports policy", () => {
    let policy: typeof import("./chat-node-ports.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("keeps a limit between one and the most a read answers", () => {
        expect(policy.limitOf({ fields: ["id"] })).toBe(NODE_ROWS_MAX)
        expect(policy.limitOf({ fields: ["id"], limit: 0 })).toBe(1)
        expect(policy.limitOf({ fields: ["id"], limit: 7 })).toBe(7)
        expect(policy.limitOf({ fields: ["id"], limit: 9999 })).toBe(NODE_ROWS_MAX)
    })

    it("cuts a row to the asked fields and matches a where", () => {
        expect(policy.cutFields({ id: "1", body: "x", secret: "s" }, ["id", "body"])).toEqual({ id: "1", body: "x" })
        expect(policy.matchesWhere({ a: 1, b: 2 }, { a: 1 })).toBe(true)
        expect(policy.matchesWhere({ a: 1 }, { a: 2 })).toBe(false)
        expect(policy.matchesWhere({ a: 1 }, undefined)).toBe(true)
    })
})

describe("chat-node-ports policy recipients and links", () => {
    let policy: typeof import("./chat-node-ports.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("puts attachments as links under the text", () => {
        expect(policy.textWithLinks({ conversationId: "c", text: "Hi" })).toBe("Hi")
        expect(
            policy.textWithLinks({
                conversationId: "c",
                text: "Hi",
                attachments: [{ url: "https://x/y", name: "Menu" }],
            }),
        ).toBe("Hi\nMenu: https://x/y")
    })

    it("needs a customer id and a connection to push to, except on the website chat", () => {
        expect(policy.recipientLinked({ channel: "website", externalId: null, connectionId: null })).toBe(true)
        expect(policy.recipientLinked({ channel: "zalo", externalId: "1234567890", connectionId: "k1" })).toBe(true)
        expect(policy.recipientLinked({ channel: "zalo", externalId: null, connectionId: "k1" })).toBe(false)
        expect(policy.recipientLinked({ channel: "zalo", externalId: "u1", connectionId: null })).toBe(false)
    })

    it("knows a placeholder Zalo sender by its id not being digits, archive suffix aside", () => {
        expect(policy.placeholderRecipient({ channel: "zalo", externalId: "1234567890123456789" })).toBe(false)
        expect(policy.placeholderRecipient({ channel: "zalo", externalId: "1234567890:1730000000" })).toBe(false)
        expect(policy.placeholderRecipient({ channel: "zalo", externalId: "import-dinh" })).toBe(true)
        expect(policy.placeholderRecipient({ channel: "zalo", externalId: ":1730" })).toBe(true)
        expect(policy.placeholderRecipient({ channel: "zalo", externalId: null })).toBe(false)
        expect(policy.placeholderRecipient({ channel: "telegram", externalId: "import-dinh" })).toBe(false)
    })

    it("names the Zalo refusals that mean the recipient cannot be reached", () => {
        expect(policy.recipientRefused("zalo_recipient")).toBe(true)
        expect(policy.recipientRefused("zalo_unfollowed")).toBe(true)
        expect(policy.recipientRefused("zalo_quota")).toBe(false)
        expect(policy.recipientRefused(null)).toBe(false)
    })

    it("admits a conversation id and a text, and refuses anything else", () => {
        expect(channelSendSchema.safeParse({ conversationId: "c", text: "t" }).success).toBe(true)
        expect(channelSendSchema.safeParse({ conversationId: "", text: "t" }).success).toBe(false)
        expect(channelSendSchema.safeParse({ conversationId: "c" }).success).toBe(false)
    })

    it("reads who holds a conversation record: a name, else nobody", () => {
        expect(policy.handledByOf({ handledBy: "Thu Ha" })).toBe("Thu Ha")
        expect(policy.handledByOf({ handledBy: null })).toBeNull()
        expect(policy.handledByOf({})).toBeNull()
    })

    it("admits a draft of a conversation id, words and what was asked, and refuses anything else", () => {
        expect(proposeReplySchema.safeParse({ conversationId: "c", text: "t", asked: "q" }).success).toBe(true)
        expect(proposeReplySchema.safeParse({ conversationId: "c", text: "", asked: "q" }).success).toBe(false)
        expect(proposeReplySchema.safeParse({ conversationId: "c", text: "t" }).success).toBe(false)
    })
})
