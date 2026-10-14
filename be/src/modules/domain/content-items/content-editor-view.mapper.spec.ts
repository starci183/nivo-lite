import { ContentItemViewMapper, ContentRangeSelectionMapper } from "./content-editor-view.mapper"
import type { ContentItem } from "./content-editor.contracts"

describe("ContentItemViewMapper", () => {
    it("copies item fields and builds editable collections with attachment defaults", () => {
        const item: ContentItem = {
            id: "post",
            workspaceId: "workspace",
            planId: "plan",
            title: "Launch",
            brief: "Brief",
            pillarId: "pillar",
            channels: ["facebook"],
            scheduledAt: "2026-10-15T00:00:00.000Z",
            status: "approved",
            variants: { facebook: { text: "Draft", hashtags: ["launch"], note: "Note" } },
            hashtags: ["shared"],
            media: [
                { kind: "media", name: "Photo", path: "workspace/photo.png", suggested: true },
                { kind: "video_render", name: "Video", id: "render", suggested: false },
                { kind: "media", name: "Missing" },
            ],
            links: [{ url: "https://example.test", label: "Source" }],
            holidayKey: "holiday",
            evidence: [{ at: "2026-10-14", kind: "saved", by: "Editor", text: "Saved draft" }],
            published: {
                facebook: { at: "2026-10-14", by: "Editor", url: "https://example.test/post", how: "manual" },
            },
            workItemId: "approval",
            draftedAt: "2026-10-12T00:00:00.000Z",
            approvedBy: "Approver",
            approvedAt: "2026-10-13T00:00:00.000Z",
            publishedAt: null,
            source: "plan",
            createdBy: "Author",
            createdAt: "2026-10-11T00:00:00.000Z",
            updatedAt: "2026-10-14T00:00:00.000Z",
        }
        const view = new ContentItemViewMapper(item)
        expect(view).toEqual({
            ...item,
            variants: [{ channel: "facebook", text: "Draft", hashtags: ["launch"], note: "Note" }],
            media: [
                { kind: "media", name: "Photo", path: "workspace/photo.png", id: null, suggested: true },
                { kind: "video_render", name: "Video", path: null, id: "render", suggested: false },
                { kind: "media", name: "Missing", path: null, id: null, suggested: false },
            ],
            published: [
                {
                    channel: "facebook",
                    at: "2026-10-14",
                    by: "Editor",
                    url: "https://example.test/post",
                    how: "manual",
                },
            ],
        })
        expect(view.channels).not.toBe(item.channels)
        expect(view.hashtags).not.toBe(item.hashtags)
        expect(view.variants[0]?.hashtags).not.toBe(item.variants.facebook?.hashtags)
        expect(view.media[0]).not.toBe(item.media[0])
        expect(view.links[0]).not.toBe(item.links[0])
        expect(view.evidence[0]).not.toBe(item.evidence[0])
        expect(view.published[0]).not.toBe(item.published.facebook)
    })
})

describe("ContentRangeSelectionMapper", () => {
    it.each([undefined, null, {}, { from: null, to: null }])("omits unbounded selections: %p", (input) => {
        expect(new ContentRangeSelectionMapper(input).range).toBeUndefined()
    })

    it.each([
        [{ from: "2026-10-01" }, { from: "2026-10-01", to: undefined }],
        [{ to: "2026-11-01" }, { from: undefined, to: "2026-11-01" }],
        [
            { from: "2026-10-01", to: "2026-11-01" },
            { from: "2026-10-01", to: "2026-11-01" },
        ],
    ])("preserves selected bounds: %p", (input, expected) => {
        expect(new ContentRangeSelectionMapper(input).range).toEqual(expected)
    })
})
