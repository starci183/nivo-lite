import { ContentPatchSelectionMapper } from "./content-editor-input.mapper"

describe("ContentPatchSelectionMapper", () => {
    it.each([{}, { title: null, channels: null, brief: null, variants: null, hashtags: null, links: null }])(
        "omits absent or nullable optional fields",
        (input) => {
            expect(new ContentPatchSelectionMapper(input).patch).toEqual({
                title: undefined,
                channels: undefined,
                scheduledAt: undefined,
                pillarId: undefined,
                brief: undefined,
                variants: undefined,
                hashtags: undefined,
                links: undefined,
                media: undefined,
            })
        },
    )

    it("retains selected fields and clears nullable schedule and pillar fields", () => {
        expect(
            new ContentPatchSelectionMapper({
                title: "Launch",
                channels: ["facebook"],
                scheduledAt: null,
                pillarId: null,
                brief: "Brief",
                variants: [{ channel: "facebook", text: "Post", hashtags: ["launch"], note: "Note" }],
                hashtags: ["shared"],
                links: [{ url: "https://example.test", label: "Source" }],
                media: [
                    { kind: "media", name: "Picture", path: "workspace/picture.png", id: "ignored", suggested: true },
                    { kind: "media", name: "Missing picture", path: null },
                    { kind: "video_render", name: "Video", id: "render-id", path: "ignored", suggested: false },
                    { kind: "video_render", name: "Missing render", id: null, suggested: null },
                    { kind: "unknown", name: "Other", path: "ignored", id: "ignored" },
                ],
            }).patch,
        ).toEqual({
            title: "Launch",
            channels: ["facebook"],
            scheduledAt: null,
            pillarId: null,
            brief: "Brief",
            variants: { facebook: { text: "Post", hashtags: ["launch"], note: "Note" } },
            hashtags: ["shared"],
            links: [{ url: "https://example.test", label: "Source" }],
            media: [
                { kind: "media", name: "Picture", path: "workspace/picture.png", id: undefined, suggested: true },
                { kind: "media", name: "Missing picture", path: undefined, id: undefined, suggested: false },
                { kind: "video_render", name: "Video", path: undefined, id: "render-id", suggested: false },
                { kind: "video_render", name: "Missing render", path: undefined, id: undefined, suggested: false },
                { kind: "unknown", name: "Other", path: undefined, id: undefined, suggested: false },
            ],
        })
    })

    it("retains empty replacements and selected schedule values", () => {
        expect(
            new ContentPatchSelectionMapper({
                title: "",
                brief: "",
                channels: [],
                variants: [],
                hashtags: [],
                links: [],
                media: [],
                scheduledAt: "2026-10-14T00:00:00.000Z",
                pillarId: "pillar",
            }).patch,
        ).toEqual({
            title: "",
            brief: "",
            channels: [],
            variants: {},
            hashtags: [],
            links: [],
            media: [],
            scheduledAt: "2026-10-14T00:00:00.000Z",
            pillarId: "pillar",
        })
        expect(new ContentPatchSelectionMapper({ media: null }).patch.media).toBeUndefined()
    })
})
