import { createHmac } from "node:crypto"
import { parseLead, parseWebhook, safeEqual, verifyChallenge, verifySignature } from "./meta-webhook.policy"

const NOW = 1_800_000_000_000
const BODY = Buffer.from('{"object":"page"}')
const signatureOf = (secret: string, body: Buffer = BODY): string =>
    `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`

describe("safeEqual", () => {
    it("compares strings of any length", () => {
        expect(safeEqual("abc", "abc")).toBe(true)
        expect(safeEqual("abc", "abd")).toBe(false)
        expect(safeEqual("abc", "abcd")).toBe(false)
    })
})

describe("verifySignature", () => {
    it("accepts the HMAC of the raw body and refuses everything else", () => {
        expect(verifySignature(signatureOf("s"), BODY, "s")).toBe(true)
        expect(verifySignature(` ${signatureOf("s").toUpperCase().replace("SHA256", "sha256")} `, BODY, "s")).toBe(true)
        expect(verifySignature(signatureOf("other"), BODY, "s")).toBe(false)
        expect(verifySignature("sha256=abc", BODY, "s")).toBe(false)
        expect(verifySignature("nonsense", BODY, "s")).toBe(false)
        expect(verifySignature(null, BODY, "s")).toBe(false)
        expect(verifySignature(signatureOf("s"), BODY, "")).toBe(false)
    })
})

describe("verifyChallenge", () => {
    const query = { mode: "subscribe", verifyToken: "tok", challenge: "c-1" }

    it("echoes the challenge for our token", () => {
        expect(verifyChallenge(query, " tok ")).toBe("c-1")
    })

    it("refuses a wrong mode, token or missing challenge or configuration", () => {
        expect(verifyChallenge({ ...query, mode: "other" }, "tok")).toBeNull()
        expect(verifyChallenge({ ...query, verifyToken: "bad" }, "tok")).toBeNull()
        expect(verifyChallenge({ ...query, verifyToken: undefined }, "tok")).toBeNull()
        expect(verifyChallenge({ ...query, challenge: undefined }, "tok")).toBeNull()
        expect(verifyChallenge(query, undefined)).toBeNull()
        expect(verifyChallenge(query, "  ")).toBeNull()
    })
})

const pageBody = (entry: object) => ({ object: "page", entry: [{ id: "PAGE", time: 1700000000, ...entry }] })
const igBody = (entry: object) => ({ object: "instagram", entry: [{ id: "IG", time: 1700000000, ...entry }] })

describe("parseWebhook", () => {
    it("ignores unknown objects and garbage", () => {
        expect(parseWebhook(null, NOW)).toEqual([])
        expect(parseWebhook({ object: "user" }, NOW)).toEqual([])
        expect(
            parseWebhook({ object: "page", entry: ["x", { id: "P", changes: ["x"], messaging: [null] }] }, NOW),
        ).toEqual([])
    })

    it("reads a Messenger text, a quick reply and an attachment, never an echo or a receipt", () => {
        const events = parseWebhook(
            pageBody({
                messaging: [
                    {
                        sender: { id: "U1" },
                        timestamp: 1700000001000,
                        message: { mid: "m1", text: "hi", referral: { ref: "r", ads_context_data: { ad_id: "A" } } },
                    },
                    {
                        sender: { id: "U2" },
                        message: { mid: "m2", quick_reply: { payload: "QR" } },
                        referral: { source: "ADS" },
                    },
                    { sender: { id: "U3" }, timestamp: 5, message: { attachments: [{}] } },
                    { sender: { id: "U4" }, message: { mid: "echo", text: "x", is_echo: true } },
                    { sender: { id: "PAGE" }, message: { mid: "own", text: "x" } },
                    { sender: { id: "U5" }, delivery: { watermark: 1 } },
                    { sender: { id: "U6" }, message: {} },
                    { sender: {}, message: { text: "x" } },
                ],
            }),
            NOW,
        )

        expect(events.map((event) => [event.kind, event.sender_psid, event.text, event.event_key])).toEqual([
            ["dm", "U1", "hi", "dm:m1"],
            ["dm", "U2", "QR", "dm:m2"],
            ["dm", "U3", null, "dm:U3:5"],
        ])
        expect(events[0]?.referral).toEqual({ ref: "r", source: null, type: null, ad_id: "A" })
        expect(events[1]?.referral).toEqual({ ref: null, source: "ADS", type: null, ad_id: null })
        expect(events[0]).toMatchObject({ page_id: "PAGE", ig_id: null, timestamp: 1700000001000 })
        expect(events[1]?.timestamp).toBe(1700000000000)
    })

    it("reads postbacks with and without a message id", () => {
        const events = parseWebhook(
            pageBody({
                messaging: [
                    {
                        sender: { id: "U1" },
                        timestamp: 9,
                        postback: { mid: "pb1", payload: "P", title: "T", referral: { type: "OPEN_THREAD" } },
                    },
                    { sender: { id: "U2" }, timestamp: 8, postback: { payload: "P2" } },
                    { sender: { id: "U3" }, timestamp: 7, postback: { title: "T3" } },
                    { sender: { id: "U4" }, timestamp: 6, postback: {} },
                ],
            }),
            NOW,
        )

        expect(events.map((event) => [event.event_key, event.text, event.postback_payload])).toEqual([
            ["postback:pb1", "T", "P"],
            ["postback:U2:8:P2", "P2", "P2"],
            ["postback:U3:7:T3", "T3", null],
            ["postback:U4:6:", null, null],
        ])
        expect(events[0]?.referral).toEqual({ ref: null, source: null, type: "OPEN_THREAD", ad_id: null })
    })

    it("reads Page changes: messages, lead ads, comments and mentions", () => {
        const events = parseWebhook(
            pageBody({
                changes: [
                    { field: "messages", value: { sender: { id: "U1" }, message: { mid: "m", text: "yo" } } },
                    { field: "messaging_postbacks", value: { sender: { id: "U1" }, postback: { payload: "P" } } },
                    {
                        field: "leadgen",
                        value: { leadgen_id: 77, page_id: "P2", form_id: "F", ad_id: "A", created_time: 1700000005 },
                    },
                    { field: "leadgen", value: { form_id: "F" } },
                    {
                        field: "feed",
                        value: {
                            item: "comment",
                            verb: "add",
                            comment_id: "C1",
                            post_id: "PO",
                            message: "nice",
                            from: { id: "U9", name: "Nine" },
                            created_time: 1700000006,
                        },
                    },
                    { field: "feed", value: { item: "comment", verb: "add", comment_id: "C2", from: { id: "PAGE" } } },
                    { field: "feed", value: { item: "post", verb: "add", comment_id: "C3" } },
                    { field: "feed", value: { item: "comment", verb: "add" } },
                    { field: "mention", value: { verb: "add", post_id: "PO2", message: "m" } },
                    { field: "mention", value: { verb: "remove", comment_id: "C4" } },
                    { field: "mention", value: { comment_id: "C5" } },
                    { field: "other", value: {} },
                    { field: "feed" },
                    { value: {} },
                ],
            }),
            NOW,
        )

        expect(events.map((event) => event.event_key)).toEqual([
            "dm:m",
            "postback:U1:1700000000000:P",
            "leadgen:77",
            "comment:C1",
            "mention:PO2",
            "mention:C5",
        ])
        expect(events[2]).toMatchObject({ page_id: "P2", form_id: "F", ad_id: "A", timestamp: 1700000005000 })
        expect(events[3]).toMatchObject({ sender_psid: "U9", sender_name: "Nine", text: "nice", post_id: "PO" })
    })

    it("reads Instagram messages, comments and mentions", () => {
        const events = parseWebhook(
            igBody({
                messaging: [{ sender: { id: "S1" }, timestamp: 4, message: { mid: "im", text: "hello" } }],
                changes: [
                    {
                        field: "messages",
                        value: { sender: { id: "S2" }, timestamp: 3, message: { mid: "im2", text: "x" } },
                    },
                    {
                        field: "comments",
                        value: { id: "IC1", text: "t", from: { id: "S3", username: "u3" }, media: { id: "MED" } },
                    },
                    { field: "comments", value: { id: "IC2", from: { id: "IG" } } },
                    { field: "comments", value: { text: "no id" } },
                    { field: "mentions", value: { comment_id: "IC3", media_id: "M3" } },
                    { field: "mentions", value: { media_id: "M4" } },
                    { field: "mentions", value: {} },
                    { field: "unknown", value: {} },
                ],
            }),
            NOW,
        )

        expect(events.map((event) => [event.platform, event.kind, event.event_key])).toEqual([
            ["instagram", "dm", "dm:im"],
            ["instagram", "dm", "dm:im2"],
            ["instagram", "comment", "comment:IC1"],
            ["instagram", "mention", "mention:IC3"],
            ["instagram", "mention", "mention:M4"],
        ])
        expect(events[2]).toMatchObject({ ig_id: "IG", sender_igsid: "S3", sender_name: "u3", post_id: "MED" })
        expect(events[0]).toMatchObject({ ig_id: "IG", page_id: null, sender_igsid: "S1" })
    })

    it("tolerates empty strings, empty referrals, anonymous comments and entries that are not objects", () => {
        const events = parseWebhook(
            {
                object: "page",
                entry: [
                    ["not an object"],
                    {
                        id: "PAGE",
                        time: 1700000000,
                        messaging: [
                            { sender: { id: "U1" }, message: { mid: "", text: "", attachments: [{}], referral: {} } },
                        ],
                        changes: [
                            { field: "leadgen", value: { leadgen_id: "L9" } },
                            { field: "feed", value: { item: "comment", verb: "add", comment_id: "C9" } },
                        ],
                    },
                ],
            },
            NOW,
        )

        expect(events.map((event) => [event.kind, event.event_key, event.timestamp])).toEqual([
            ["dm", "dm:U1:1700000000000", 1700000000000],
            ["leadgen", "leadgen:L9", 1700000000000],
            ["comment", "comment:C9", 1700000000000],
        ])
        expect(events[0]?.referral).toBeNull()
        expect(events[2]).toMatchObject({ sender_psid: null, sender_name: null, text: null })
    })

    it("reads numeric strings from Meta and drops mentions and changes with nothing to key on", () => {
        const events = parseWebhook(
            {
                object: "page",
                entry: [
                    {
                        id: "PAGE",
                        time: "1700000000",
                        messaging: [
                            { sender: { id: "U1" }, timestamp: "1700000002000", message: { mid: "m", text: "t" } },
                        ],
                        changes: [{ field: "mention", value: { verb: "add" } }],
                    },
                ],
            },
            NOW,
        )

        expect(events.map((event) => event.timestamp)).toEqual([1700000002000])
        expect(parseWebhook(igBody({ changes: [{ field: "comments" }, { value: {} }] }), NOW)).toEqual([])
    })

    it("reads an Instagram comment without author or media", () => {
        const events = parseWebhook(igBody({ changes: [{ field: "comments", value: { id: "IC9" } }] }), NOW)

        expect(events[0]).toMatchObject({ sender_igsid: null, sender_name: null, post_id: null, text: null })
    })

    it("uses the current time for an entry with no time", () => {
        const events = parseWebhook(
            {
                object: "page",
                entry: [{ id: "P", messaging: [{ sender: { id: "U" }, message: { mid: "m", text: "t" } }] }],
            },
            NOW,
        )

        expect(events[0]?.timestamp).toBe(NOW)
    })
})

describe("parseLead", () => {
    it("reads the contact and keeps every answer", () => {
        const lead = parseLead({
            ad_id: "A",
            form_id: "F",
            created_time: "2026-10-12T00:00:00+0000",
            field_data: [
                { name: "full_name", values: ["An Nguyen"] },
                { name: "phone_number", values: ["+84 90-123 4567"] },
                { name: "email", values: ["a@b.vn"] },
                { name: "size", values: ["M", 3] },
                { name: "empty", values: [] },
                { values: ["x"] },
                "bad",
            ],
        })

        expect(lead).toEqual({
            name: "An Nguyen",
            phone: "+84901234567",
            email: "a@b.vn",
            fields: { full_name: "An Nguyen", phone_number: "+84 90-123 4567", email: "a@b.vn", size: "M, 3" },
            ad_id: "A",
            form_id: "F",
            created_at: "2026-10-12T00:00:00+0000",
        })
    })

    it("builds the name from the parts and tolerates a lead with nothing", () => {
        expect(
            parseLead({
                field_data: [
                    { name: "first_name", values: ["An"] },
                    { name: "last_name", values: ["B"] },
                    { name: "phone", values: ["abc"] },
                ],
            }),
        ).toMatchObject({
            name: "An B",
            phone: null,
        })
        expect(parseLead(undefined)).toEqual({
            name: null,
            phone: null,
            email: null,
            fields: {},
            ad_id: null,
            form_id: null,
            created_at: null,
        })
    })
})
