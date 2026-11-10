import { Test } from "@nestjs/testing"
import {
    NODE_ROWS_MAX,
    channelBusy,
    placeholderRecipient,
    recipientRefused,
    recipientLinked,
    cutFields,
    limitOf,
    matchesWhere,
    sendRightOf,
    draftNoticeOf,
    textWithLinks,
    verdictOf,
    outboundOf,
} from "./chat-node-ports.policy"
import { channelSendSchema, customerMessageSendSchema } from "./chat-node-ports.schema"

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
                    outboundOf,
                    sendRightOf,
                    draftNoticeOf,
                    verdictOf,
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

    it("admits a customer send addressed by the conversation or by the customer, and refuses one with neither", () => {
        expect(customerMessageSendSchema.safeParse({ conversationId: "c", text: "t", orderId: "o" }).success).toBe(true)
        expect(customerMessageSendSchema.safeParse({ leadId: "l", text: "t", channel: "zalo" }).success).toBe(true)
        expect(customerMessageSendSchema.safeParse({ text: "t" }).success).toBe(false)
        expect(customerMessageSendSchema.safeParse({ leadId: "l", text: "" }).success).toBe(false)
        const tooMany = Array.from({ length: 11 }, (_, index) => `i${String(index)}`)
        expect(customerMessageSendSchema.safeParse({ conversationId: "c", text: "t", catalogueItemIds: tooMany }).success).toBe(
            false,
        )
    })

    it("lets the calling agent's ability on the channel's provider decide the send, and the agent's rule \"ask\" drafts whatever the tick", () => {
        const allow = { kind: "allow", provider: "zalo_oa", ability: "customer.send" } as const
        const approval = { kind: "approval", provider: "zalo_oa", ability: "customer.send" } as const
        const refuse = { reason: "not_attached", ability: "customer.send", providers: ["zalo_oa"] }
        expect(policy.sendRightOf(allow, "")).toEqual({ kind: "send" })
        expect(policy.sendRightOf(approval, "")).toEqual({ kind: "draft" })
        expect(policy.sendRightOf(allow, " Ask ")).toEqual({ kind: "draft" })
        expect(policy.sendRightOf(allow, "Ask over 1m")).toEqual({ kind: "send" })
        expect(policy.sendRightOf({ kind: "refuse", ...refuse }, "ask")).toEqual({
            kind: "refused",
            facts: { provider: "zalo_oa", ability: "customer.send", reason: "not_attached" },
        })
        expect(policy.sendRightOf(null, "")).toEqual({ kind: "send" })
        expect(policy.sendRightOf(null, "ask")).toEqual({ kind: "draft" })
    })

    it("reads the verdict of a delivery receipt", () => {
        expect(policy.verdictOf({ delivered: true, outcome: "acknowledged" })).toBe("delivered")
        expect(policy.verdictOf({ delivered: false, outcome: "rejected" })).toBe("not_delivered")
        expect(policy.verdictOf({ delivered: false, outcome: "ambiguous" })).toBe("unknown")
    })

    it("words the owner's notice of a draft with who it is for and the draft", () => {
        const copy = { title: "T", lead: "For {who}:", someone: "the customer" }
        expect(policy.draftNoticeOf(copy, "An", "Chao chi")).toBe("For An:\nChao chi")
        expect(policy.draftNoticeOf(copy, null, "Hi")).toBe("For the customer:\nHi")
    })
})

describe("channelBusy", () => {
    it("is true for the Zalo refusals that say the channel is not taking messages for now, false for every other verdict", () => {
        expect(channelBusy("zalo_quota")).toBe(true)
        expect(channelBusy("zalo_night_hours")).toBe(true)
        for (const failure of ["zalo_window_expired", "zalo_token", "zalo_error", "channel_plan", null]) {
            expect(channelBusy(failure)).toBe(false)
        }
    })
})

describe("chat-node-ports policy outbound", () => {
    let policy: typeof import("./chat-node-ports.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("sends the image files of a Zalo message as pictures after the text and keeps the other files as links", () => {
        const send = {
            conversationId: "c",
            text: "Hi",
            attachments: [
                { url: "https://x/a.jpg", name: "A", contentType: "image/jpeg" },
                { url: "https://x/menu.pdf", name: "Menu", contentType: "application/pdf" },
                { url: "https://x/b", name: "B" },
            ],
        }

        expect(policy.outboundOf(send, "zalo")).toEqual({
            text: "Hi\nMenu: https://x/menu.pdf\nB: https://x/b",
            images: [{ url: "https://x/a.jpg", caption: "A" }],
        })
    })

    it("keeps every file a link on Telegram, which shows only the images field", () => {
        const send = {
            conversationId: "c",
            text: "Hi",
            attachments: [{ url: "https://x/a.jpg", name: "A", contentType: "image/jpeg" }],
        }

        expect(policy.outboundOf(send, "telegram")).toEqual({ text: "Hi\nA: https://x/a.jpg", images: [] })
    })

    const captioned = [
        { url: "https://x/1.jpg", caption: "Basket\n2.000 VND" },
        { url: "https://x/2.jpg", caption: "Pot\n1.000 VND" },
    ]

    it("passes the captioned images as pictures on Zalo and on Telegram", () => {
        const send = { conversationId: "c", text: "Hi", images: captioned }

        expect(policy.outboundOf(send, "zalo")).toEqual({ text: "Hi", images: captioned })
        expect(policy.outboundOf(send, "telegram")).toEqual({ text: "Hi", images: captioned })
    })

    it("puts the captioned images under the text as links on a channel that cannot show pictures", () => {
        const send = { conversationId: "c", text: "Hi", images: captioned }

        expect(policy.outboundOf(send, "website")).toEqual({
            text: "Hi\nBasket - 2.000 VND: https://x/1.jpg\nPot - 1.000 VND: https://x/2.jpg",
            images: [],
        })
    })

    it("keeps a caller that sends no images exactly as before", () => {
        expect(policy.outboundOf({ conversationId: "c", text: "Hi" }, "zalo")).toEqual({ text: "Hi", images: [] })
        expect(policy.outboundOf({ conversationId: "c", text: "Hi" }, "website")).toEqual({ text: "Hi", images: [] })
    })

    it("admits images with a caption and refuses more than ten", () => {
        const base = { conversationId: "c", text: "t" }
        expect(channelSendSchema.safeParse({ ...base, images: captioned }).success).toBe(true)
        expect(channelSendSchema.safeParse({ ...base, images: [{ url: "", caption: "x" }] }).success).toBe(false)
        const eleven = Array.from({ length: 11 }, () => captioned[0])
        expect(channelSendSchema.safeParse({ ...base, images: eleven }).success).toBe(false)
    })
})
