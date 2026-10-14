import {
    contentChannels,
    contentHashtags,
    contentHasText,
    contentTransition,
    contentVariants,
    mergeContentPatch,
    requireContentInput,
} from "./content-editor.policy"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import type { ContentItem, SaveContentItem } from "./content-editor.contracts"

const item = (overrides: Partial<ContentItem> = {}): ContentItem => ({
    id: "post",
    workspaceId: "workspace",
    planId: null,
    title: "Title",
    brief: "Brief",
    pillarId: "pillar",
    channels: ["facebook"],
    scheduledAt: "2026-10-15T00:00:00.000Z",
    status: "idea",
    variants: {},
    hashtags: ["original"],
    media: [{ kind: "media", name: "Original", path: "workspace/original.png" }],
    links: [{ url: "https://example.test/original", label: "Original" }],
    holidayKey: null,
    evidence: [],
    published: {},
    workItemId: null,
    draftedAt: null,
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
    source: "manual",
    createdBy: "Editor",
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    ...overrides,
})

const expectFailure = (action: () => unknown, code: ContentItemsErrorCode): void => {
    expect(action).toThrow(ContentItemsError)
    expect(action).toThrow(expect.objectContaining({ code }))
}

describe("content editor input policies", () => {
    it("accepts valid input and returns the stable invalid-input error", () => {
        expect(requireContentInput(true)).toBeUndefined()
        expectFailure(() => requireContentInput(false), ContentItemsErrorCode.InvalidInput)
    })

    it("canonicalizes, deduplicates and bounds hashtags", () => {
        expect(contentHashtags([" ## Hello world ", "#Helloworld", " ", "###", " #second "])).toEqual([
            "Helloworld",
            "second",
        ])
        expect(contentHashtags(["x".repeat(81)])).toEqual(["x".repeat(80)])
        expect(contentHashtags(Array.from({ length: 31 }, (_, index) => `tag${index}`))).toEqual(
            Array.from({ length: 30 }, (_, index) => `tag${index}`),
        )
    })

    it("retains supported channels in first-selected order", () => {
        expect(contentChannels(["zalo", "facebook", "zalo"])).toEqual(["zalo", "facebook"])
    })

    it.each([
        { channels: [] },
        { channels: ["unsupported"] },
        { channels: ["facebook", "zalo", "tiktok", "instagram", "facebook"] },
    ])("rejects empty, unsupported or oversized channel selections: %p", ({ channels }) => {
        expectFailure(() => contentChannels(channels), ContentItemsErrorCode.InvalidInput)
    })

    it("normalizes supported channel texts and rejects unknown channel keys", () => {
        expect(
            contentVariants({ facebook: { text: "x".repeat(6001), hashtags: [" # shared "], note: "n".repeat(601) } }),
        ).toEqual({
            facebook: { text: "x".repeat(6000), hashtags: ["shared"], note: "n".repeat(600) },
        })
        expect(contentVariants({})).toEqual({})
        expectFailure(
            () => contentVariants({ unsupported: { text: "Draft", hashtags: [], note: "" } }),
            ContentItemsErrorCode.InvalidInput,
        )
    })

    it("requires at least one nonblank channel text", () => {
        expect(contentHasText({ variants: {} })).toBe(false)
        expect(contentHasText({ variants: { facebook: { text: " \n ", hashtags: [], note: "Note" } } })).toBe(false)
        expect(contentHasText({ variants: { zalo: { text: " Draft ", hashtags: [], note: "" } } })).toBe(true)
    })
})

describe("content lifecycle transitions", () => {
    it.each(["idea", "draft", "approved"])("skips a post in %s", (status) => {
        expect(contentTransition(item({ status }), "skip")).toBe("skipped")
    })

    it("restores skipped posts according to their remaining text and reopens approval", () => {
        expect(contentTransition(item({ status: "skipped" }), "restore")).toBe("idea")
        expect(
            contentTransition(
                item({ status: "skipped", variants: { facebook: { text: "Draft", hashtags: [], note: "" } } }),
                "restore",
            ),
        ).toBe("draft")
        expect(contentTransition(item({ status: "approved" }), "reopen")).toBe("draft")
    })

    it.each([
        ["published", "skip"],
        ["idea", "restore"],
        ["draft", "reopen"],
        ["idea", "unknown"],
    ])("rejects %s -> %s", (status, kind) => {
        expectFailure(() => contentTransition(item({ status }), kind), ContentItemsErrorCode.WrongStatus)
    })
})

describe("mergeContentPatch", () => {
    it("preserves an open post when no replacement was selected", () => {
        const original = item()
        expect(mergeContentPatch(original, {}, "workspace")).toEqual(original)
        expect(mergeContentPatch(item({ status: "draft" }), {}, "workspace")).toEqual(item({ status: "draft" }))
    })

    it("normalizes every selected editable field and promotes an idea with text to draft", () => {
        const patch: SaveContentItem = {
            title: `  ${"T".repeat(201)}  `,
            brief: "B".repeat(4001),
            pillarId: null,
            channels: ["zalo", "zalo"],
            scheduledAt: null,
            variants: { zalo: { text: "Draft", hashtags: ["#channel"], note: "Note" } },
            hashtags: [" # shared ", "shared"],
            links: [
                { url: "ftp://example.test", label: "Ignored" },
                { url: "HTTPS://example.test/source  ", label: "L".repeat(81) },
            ],
            media: [
                { kind: "media", name: "Photo", path: "workspace/photo.png" },
                { kind: "video_render", name: "Render", id: "ABCDEFAB-1234-5678-9012-ABCDEFABCDEF" },
            ],
        }
        expect(mergeContentPatch(item(), patch, "workspace")).toEqual({
            ...item(),
            title: "T".repeat(200),
            brief: "B".repeat(4000),
            pillarId: null,
            channels: ["zalo"],
            scheduledAt: null,
            variants: { zalo: { text: "Draft", hashtags: ["channel"], note: "Note" } },
            hashtags: ["shared"],
            links: [{ url: "HTTPS://example.test/source", label: "L".repeat(80) }],
            media: patch.media,
            status: "draft",
        })
    })

    it("replaces selected fields with empty collections without promoting a blank idea", () => {
        const patch: SaveContentItem = {
            brief: "",
            pillarId: "new-pillar",
            channels: ["instagram"],
            scheduledAt: "new-time",
            variants: {},
            hashtags: [],
            links: [],
            media: [],
        }
        expect(mergeContentPatch(item(), patch, "workspace")).toEqual({ ...item(), ...patch })
    })

    it("caps accepted supporting links at ten", () => {
        const links = Array.from({ length: 11 }, (_, index) => ({
            url: `http://example.test/${index}`,
            label: `${index}`,
        }))
        expect(mergeContentPatch(item(), { links }, "workspace").links).toEqual(links.slice(0, 10))
    })

    it("refuses an all-whitespace title", () => {
        expectFailure(
            () => mergeContentPatch(item(), { title: " \n " }, "workspace"),
            ContentItemsErrorCode.InvalidInput,
        )
    })

    it.each([
        { media: [{ kind: "video_render", name: "Missing render" }] },
        { media: [{ kind: "video_render", name: "Bad render", id: "not-a-uuid" }] },
        { media: [{ kind: "other", name: "Unknown kind" }] },
        { media: [{ kind: "media", name: "Missing path" }] },
        { media: [{ kind: "media", name: "Other workspace", path: "other/photo.png" }] },
        { media: Array.from({ length: 11 }, () => ({ kind: "media", name: "Photo", path: "workspace/photo.png" })) },
    ])("refuses invalid attachments: %p", ({ media }) => {
        expectFailure(() => mergeContentPatch(item(), { media }, "workspace"), ContentItemsErrorCode.InvalidInput)
    })

    it("lets an approved post move or clear its schedule while preserving its editor data", () => {
        const original = item({ status: "approved" })
        expect(mergeContentPatch(original, { scheduledAt: "new-time", title: "Ignored" }, "workspace")).toEqual({
            ...original,
            scheduledAt: "new-time",
        })
        expect(mergeContentPatch(original, { scheduledAt: null }, "workspace")).toEqual({
            ...original,
            scheduledAt: null,
        })
    })

    it.each([
        ["approved", {}],
        ["published", { scheduledAt: "new-time" }],
        ["published", {}],
    ])("rejects frozen edits on %s", (status, patch) => {
        expectFailure(() => mergeContentPatch(item({ status }), patch, "workspace"), ContentItemsErrorCode.Frozen)
    })
})
