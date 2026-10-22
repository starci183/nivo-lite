import { Test } from "@nestjs/testing"
import { isOfficeRoomKey as realIsOfficeRoomKey, parseOfficeCard as realParseOfficeCard } from "./office-card.policy"

const SUBJECT = Symbol("office-card.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { isOfficeRoomKey: realIsOfficeRoomKey, parseOfficeCard: realParseOfficeCard },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./office-card.policy")>(SUBJECT)
}

const REF_ID = "0b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b"

const full = {
    v: 1,
    type: "draft_post",
    title: "A slow weekend",
    subtitle: "Spa offer -20%",
    badge: "Needs you",
    body: "Leave the rush behind...",
    fields: [{ label: "Channel", value: "Facebook Page" }],
    media: [
        { kind: "image", url: "https://cdn.example.com/a.jpg", caption: "Image 1" },
        { kind: "video", url: "/videos/b.mp4", captions: { url: "https://cdn.example.com/b.vtt", lang: "vi-VN" } },
    ],
    lines: [{ at: "00-05s", text: "Candles, warm towels." }],
    link: { label: "Open", href: "/content" },
    ref: { kind: "execution", id: REF_ID },
    actions: ["approve", "edit", "decline"],
    sources: [
        { layer: 2, kind: "brain_document", ref: "doc-1", label: "Brand guideline", href: "/brain" },
        { layer: 1, kind: "mcp_tool", ref: "rooms.searchAvailability", label: "Rooms availability" },
    ],
    data: { postId: "p-1" },
}

/** Each malformed card part, with the refusal reason the parser must answer. */
const REFUSALS: Array<[name: string, input: unknown, reason: string]> = [
    ["a non-object", "text", "card must be an object"],
    ["a list", [], "card must be an object"],
    ["an unknown key", { ...full, extra: 1 }, "unknown key extra"],
    ["another version", { ...full, v: 2 }, "v must be 1"],
    ["an unknown type", { ...full, type: "poem" }, "type is not a card type"],
    ["an empty title", { ...full, title: "  " }, "title must be a text of 1..160 characters"],
    ["a long title", { ...full, title: "x".repeat(161) }, "title must be a text of 1..160 characters"],
    ["a non-text subtitle", { ...full, subtitle: 3 }, "subtitle must be a text of 1..240 characters"],
    ["fields that are not a list", { ...full, fields: {} }, "fields must be a list of at most 12"],
    [
        "too many fields",
        { ...full, fields: Array(13).fill({ label: "a", value: "b" }) },
        "fields must be a list of at most 12",
    ],
    ["a field that is not an object", { ...full, fields: ["x"] }, "fields[0] must be an object"],
    [
        "a field without value",
        { ...full, fields: [{ label: "a" }] },
        "fields[0].value must be a text of 1..400 characters",
    ],
    [
        "a media of another kind",
        { ...full, media: [{ kind: "audio", url: "/a" }] },
        "media[0].kind must be image or video",
    ],
    [
        "a protocol-relative media url",
        { ...full, media: [{ kind: "image", url: "//evil" }] },
        "media[0].url must be https or app-relative",
    ],
    [
        "an http media url",
        { ...full, media: [{ kind: "image", url: "http://x" }] },
        "media[0].url must be https or app-relative",
    ],
    [
        "a line marker that is not text",
        { ...full, lines: [{ at: 1, text: "a" }] },
        "lines[0].at must be a text of at most 40",
    ],
    [
        "a long line marker",
        { ...full, lines: [{ at: "x".repeat(41), text: "a" }] },
        "lines[0].at must be a text of at most 40",
    ],
    ["a link without href", { ...full, link: { label: "Open" } }, "link.href must be a text of 1..2000 characters"],
    [
        "a ref of another kind",
        { ...full, ref: { kind: "lead", id: REF_ID } },
        "ref.kind must be execution or work_item",
    ],
    ["a ref id that is not a uuid", { ...full, ref: { kind: "execution", id: "x" } }, "ref.id must be a uuid"],
    ["a ref id that is not text", { ...full, ref: { kind: "execution", id: 5 } }, "ref.id must be a uuid"],
    [
        "a field label that is not text",
        { ...full, fields: [{ label: 1, value: "b" }] },
        "fields[0].label must be a text of 1..80 characters",
    ],
    ["actions without a ref", { v: 1, type: "exception", title: "a", actions: ["approve"] }, "actions need a ref"],
    ["an unknown action", { ...full, actions: ["delete"] }, "actions[0] is not an action"],
    [
        "a source of another layer",
        { ...full, sources: [{ layer: 5, kind: "k", ref: "r", label: "x" }] },
        "sources[0].layer must be 1, 2, 3 or 4",
    ],
    [
        "a source without label",
        { ...full, sources: [{ layer: 1, kind: "k", ref: "r" }] },
        "sources[0].label must be a text of 1..160 characters",
    ],
    [
        "a source without ref",
        { ...full, sources: [{ layer: 1, kind: "k", label: "x" }] },
        "sources[0].ref must be a text of 1..200 characters",
    ],
    [
        "a source with an http href",
        { ...full, sources: [{ layer: 1, kind: "k", ref: "r", label: "x", href: "http://x" }] },
        "sources[0].href must be https or app-relative",
    ],
    ["data that is not an object", { ...full, data: [1] }, "data must be an object"],
    ["data that is too big", { ...full, data: { blob: "x".repeat(16_400) } }, "data must be at most 16384 characters"],
]

describe("parseOfficeCard", () => {
    it("reads a full card and keeps every part", async () => {
        const subject = await build()

        expect(subject.parseOfficeCard(full)).toEqual({ ok: true, card: full })
    })

    it("reads a minimal card without adding absent keys", async () => {
        const subject = await build()

        const parsed = subject.parseOfficeCard({ v: 1, type: "handoff_note", title: "Guest moved to care" })

        expect(parsed).toEqual({ ok: true, card: { v: 1, type: "handoff_note", title: "Guest moved to care" } })
    })

    it("reads a work item ref", async () => {
        const subject = await build()

        const parsed = subject.parseOfficeCard({
            v: 1,
            type: "exception",
            title: "Amount mismatch",
            ref: { kind: "work_item", id: REF_ID },
            actions: ["approve"],
        })

        expect(parsed).toMatchObject({ ok: true, card: { ref: { kind: "work_item", id: REF_ID } } })
    })

    it.each(REFUSALS)("refuses %s", async (_name, input, reason) => {
        const subject = await build()

        expect(subject.parseOfficeCard(input)).toEqual({ ok: false, reason })
    })
})

describe("parseOfficeCard captions", () => {
    it("reads a video without captions and captions whose language is not known", async () => {
        const subject = await build()

        const parsed = subject.parseOfficeCard({
            v: 1,
            type: "video_ready",
            title: "Weekend",
            media: [
                { kind: "video", url: "/videos/a.mp4", captions: null },
                { kind: "video", url: "/videos/b.mp4", captions: { url: "/videos/b.vtt" } },
                { kind: "video", url: "/videos/c.mp4", captions: { url: "/videos/c.vtt", lang: null } },
            ],
        })

        expect(parsed).toEqual({
            ok: true,
            card: {
                v: 1,
                type: "video_ready",
                title: "Weekend",
                media: [
                    { kind: "video", url: "/videos/a.mp4", captions: null },
                    { kind: "video", url: "/videos/b.mp4", captions: { url: "/videos/b.vtt", lang: null } },
                    { kind: "video", url: "/videos/c.mp4", captions: { url: "/videos/c.vtt", lang: null } },
                ],
            },
        })
    })

    it.each([
        [
            "captions on an image",
            { ...full, media: [{ kind: "image", url: "/a.jpg", captions: { url: "/a.vtt", lang: "vi" } }] },
            "media[0].captions are only for a video",
        ],
        [
            "captions that are not an object",
            { ...full, media: [{ kind: "video", url: "/b.mp4", captions: "b.vtt" }] },
            "media[0].captions must be an object",
        ],
        [
            "an http captions url",
            { ...full, media: [{ kind: "video", url: "/b.mp4", captions: { url: "http://x/b.vtt", lang: "vi" } }] },
            "media[0].captions.url must be https or app-relative",
        ],
        [
            "a captions language that is not a tag",
            { ...full, media: [{ kind: "video", url: "/b.mp4", captions: { url: "/b.vtt", lang: "Vietnamese!" } }] },
            "media[0].captions.lang must be a language tag",
        ],
        [
            "a captions language that is not text",
            { ...full, media: [{ kind: "video", url: "/b.mp4", captions: { url: "/b.vtt", lang: 5 } }] },
            "media[0].captions.lang must be a language tag",
        ],
    ])("refuses %s", async (_name, input, reason) => {
        const subject = await build()

        expect(subject.parseOfficeCard(input)).toEqual({ ok: false, reason })
    })
})

describe("isOfficeRoomKey", () => {
    it.each(["executive", "frontdesk", "sales", "marketing", "care", "accounting"])("accepts %s", async (key) => {
        const subject = await build()

        expect(subject.isOfficeRoomKey(key)).toBe(true)
    })

    it.each(["lobby", null, 3])("refuses %p", async (key) => {
        const subject = await build()

        expect(subject.isOfficeRoomKey(key)).toBe(false)
    })
})
