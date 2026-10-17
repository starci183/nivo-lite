import { Test } from "@nestjs/testing"
import {
    requireContentInput,
    contentHashtags,
    contentChannels,
    contentVariants,
    contentHasText,
    contentTransition,
    mergeContentPatch,
} from "./content-editor.policy"
import { ContentItemsError, ContentItemsErrorCode } from "./errors/content-items.error"
import type { ContentItem, SaveContentItem } from "./content-editor.contracts"

const SUBJECT = Symbol("content-editor.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    requireContentInput,
                    contentHashtags,
                    contentChannels,
                    contentVariants,
                    contentHasText,
                    contentTransition,
                    mergeContentPatch,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./content-editor.policy")>(SUBJECT)
}

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
    it("accepts valid input and returns the stable invalid-input error", async () => {
        const subject = await build()

        expect(subject.requireContentInput(true)).toBeUndefined()
        expectFailure(() => subject.requireContentInput(false), ContentItemsErrorCode.InvalidInput)
    })

    it("canonicalizes, deduplicates and bounds hashtags", async () => {
        const subject = await build()

        expect(subject.contentHashtags([" ## Hello world ", "#Helloworld", " ", "###", " #second "])).toEqual([
            "Helloworld",
            "second",
        ])
        expect(subject.contentHashtags(["x".repeat(81)])).toEqual(["x".repeat(80)])
        expect(subject.contentHashtags(Array.from({ length: 31 }, (_, index) => `tag${index}`))).toEqual(
            Array.from({ length: 30 }, (_, index) => `tag${index}`),
        )
    })

    it("retains supported channels in first-selected order", async () => {
        const subject = await build()

        expect(subject.contentChannels(["zalo", "facebook", "zalo"])).toEqual(["zalo", "facebook"])
    })

    it.each([
        { channels: [] },
        { channels: ["unsupported"] },
        { channels: ["facebook", "zalo", "tiktok", "instagram", "facebook"] },
    ])("rejects empty, unsupported or oversized channel selections: %p", async ({ channels }) => {
        const subject = await build()

        expectFailure(() => subject.contentChannels(channels), ContentItemsErrorCode.InvalidInput)
    })

    it("normalizes supported channel texts and rejects unknown channel keys", async () => {
        const subject = await build()

        expect(
            subject.contentVariants({
                facebook: { text: "x".repeat(6001), hashtags: [" # shared "], note: "n".repeat(601) },
            }),
        ).toEqual({
            facebook: { text: "x".repeat(6000), hashtags: ["shared"], note: "n".repeat(600) },
        })
        expect(subject.contentVariants({})).toEqual({})
        expectFailure(
            () => subject.contentVariants({ unsupported: { text: "Draft", hashtags: [], note: "" } }),
            ContentItemsErrorCode.InvalidInput,
        )
    })

    it("requires at least one nonblank channel text", async () => {
        const subject = await build()

        expect(subject.contentHasText({ variants: {} })).toBe(false)
        expect(subject.contentHasText({ variants: { facebook: { text: " \n ", hashtags: [], note: "Note" } } })).toBe(
            false,
        )
        expect(subject.contentHasText({ variants: { zalo: { text: " Draft ", hashtags: [], note: "" } } })).toBe(true)
    })
})

describe("content lifecycle transitions", () => {
    it.each(["idea", "draft", "approved"])("skips a post in %s", async (status) => {
        const subject = await build()

        expect(subject.contentTransition(item({ status }), "skip")).toBe("skipped")
    })

    it("restores skipped posts according to their remaining text and reopens approval", async () => {
        const subject = await build()

        expect(subject.contentTransition(item({ status: "skipped" }), "restore")).toBe("idea")
        expect(
            subject.contentTransition(
                item({ status: "skipped", variants: { facebook: { text: "Draft", hashtags: [], note: "" } } }),
                "restore",
            ),
        ).toBe("draft")
        expect(subject.contentTransition(item({ status: "approved" }), "reopen")).toBe("draft")
    })

    it.each([
        ["published", "skip"],
        ["idea", "restore"],
        ["draft", "reopen"],
        ["idea", "unknown"],
    ])("rejects %s -> %s", async (status, kind) => {
        const subject = await build()

        expectFailure(() => subject.contentTransition(item({ status }), kind), ContentItemsErrorCode.WrongStatus)
    })
})

describe("mergeContentPatch", () => {
    it("preserves an open post when no replacement was selected", async () => {
        const subject = await build()

        const original = item()
        expect(subject.mergeContentPatch(original, {}, "workspace")).toEqual(original)
        expect(subject.mergeContentPatch(item({ status: "draft" }), {}, "workspace")).toEqual(item({ status: "draft" }))
    })
})

describe("mergeContentPatch", () => {
    it("normalizes every selected editable field and promotes an idea with text to draft", async () => {
        const subject = await build()

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
        expect(subject.mergeContentPatch(item(), patch, "workspace")).toEqual({
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
})

describe("mergeContentPatch", () => {
    it("replaces selected fields with empty collections without promoting a blank idea", async () => {
        const subject = await build()

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
        expect(subject.mergeContentPatch(item(), patch, "workspace")).toEqual({ ...item(), ...patch })
    })
})

describe("mergeContentPatch", () => {
    it("caps accepted supporting links at ten", async () => {
        const subject = await build()

        const links = Array.from({ length: 11 }, (_, index) => ({
            url: `http://example.test/${index}`,
            label: `${index}`,
        }))
        expect(subject.mergeContentPatch(item(), { links }, "workspace").links).toEqual(links.slice(0, 10))
    })
})

describe("mergeContentPatch", () => {
    it("refuses an all-whitespace title", async () => {
        const subject = await build()

        expectFailure(
            () => subject.mergeContentPatch(item(), { title: " \n " }, "workspace"),
            ContentItemsErrorCode.InvalidInput,
        )
    })
})

describe("mergeContentPatch", () => {
    it.each([
        { media: [{ kind: "video_render", name: "Missing render" }] },
        { media: [{ kind: "video_render", name: "Bad render", id: "not-a-uuid" }] },
        { media: [{ kind: "other", name: "Unknown kind" }] },
        { media: [{ kind: "media", name: "Missing path" }] },
        { media: [{ kind: "media", name: "Other workspace", path: "other/photo.png" }] },
        { media: Array.from({ length: 11 }, () => ({ kind: "media", name: "Photo", path: "workspace/photo.png" })) },
    ])("refuses invalid attachments: %p", async ({ media }) => {
        const subject = await build()

        expectFailure(
            () => subject.mergeContentPatch(item(), { media }, "workspace"),
            ContentItemsErrorCode.InvalidInput,
        )
    })
})

describe("mergeContentPatch", () => {
    it("lets an approved post move or clear its schedule while preserving its editor data", async () => {
        const subject = await build()

        const original = item({ status: "approved" })
        expect(subject.mergeContentPatch(original, { scheduledAt: "new-time", title: "Ignored" }, "workspace")).toEqual(
            {
                ...original,
                scheduledAt: "new-time",
            },
        )
        expect(subject.mergeContentPatch(original, { scheduledAt: null }, "workspace")).toEqual({
            ...original,
            scheduledAt: null,
        })
    })
})

describe("mergeContentPatch", () => {
    it.each([
        ["approved", {}],
        ["published", { scheduledAt: "new-time" }],
        ["published", {}],
    ])("rejects frozen edits on %s", async (status, patch) => {
        const subject = await build()

        expectFailure(
            () => subject.mergeContentPatch(item({ status }), patch, "workspace"),
            ContentItemsErrorCode.Frozen,
        )
    })
})
