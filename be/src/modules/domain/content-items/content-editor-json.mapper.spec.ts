import {
    readContentEvidence,
    readContentLinks,
    readContentMedia,
    readContentPublished,
    readContentVariants,
} from "./content-editor-json.mapper"

describe("content editor historical JSON readers", () => {
    it.each([undefined, null, 1, "invalid", []])("ignores malformed channel maps: %p", (value) => {
        expect(readContentVariants(value)).toEqual({})
        expect(readContentPublished(value)).toEqual({})
    })

    it("selects supported channel objects and fills missing variant fields", () => {
        expect(
            readContentVariants({
                facebook: { text: "Draft", hashtags: ["one", 2, null], note: "Note" },
                zalo: { text: 12, hashtags: "not an array", note: false },
                tiktok: null,
                instagram: [],
                unsupported: { text: "Ignored" },
            }),
        ).toEqual({
            facebook: { text: "Draft", hashtags: ["one", "2", "null"], note: "Note" },
            zalo: { text: "", hashtags: [], note: "" },
        })
    })

    it("selects supported publication proofs and defaults malformed members", () => {
        expect(
            readContentPublished({
                facebook: { at: "2026-10-14", by: "Editor", url: "https://example.test/post", how: "manual" },
                zalo: { at: null, by: 1 },
                tiktok: "invalid",
                other: {},
            }),
        ).toEqual({
            facebook: { at: "2026-10-14", by: "Editor", url: "https://example.test/post", how: "manual" },
            zalo: { at: "", by: "", url: "", how: "" },
        })
    })

    it.each([undefined, null, {}, "invalid"])("defaults malformed collections: %p", (value) => {
        expect(readContentMedia(value)).toEqual([])
        expect(readContentLinks(value)).toEqual([])
        expect(readContentEvidence(value)).toEqual([])
    })

    it("normalizes attachments and omits malformed array elements", () => {
        expect(
            readContentMedia([
                null,
                [],
                "invalid",
                { kind: "video_render", name: "Render", path: "workspace/video.mp4", id: "render", suggested: true },
                { kind: "unknown", name: 1, path: "", id: null, suggested: "true" },
            ]),
        ).toEqual([
            { kind: "video_render", name: "Render", path: "workspace/video.mp4", id: "render", suggested: true },
            { kind: "media", name: "", path: undefined, id: undefined, suggested: false },
        ])
    })

    it("preserves link and audit text while defaulting invalid fields", () => {
        expect(
            readContentLinks([null, [], 1, { url: "https://example.test", label: "Source" }, { url: null }]),
        ).toEqual([
            { url: "https://example.test", label: "Source" },
            { url: "", label: "" },
        ])
        expect(
            readContentEvidence([
                null,
                [],
                false,
                { at: "2026-10-14", kind: "saved", by: "Editor", text: "Saved draft" },
                { at: 0, text: null },
            ]),
        ).toEqual([
            { at: "2026-10-14", kind: "saved", by: "Editor", text: "Saved draft" },
            { at: "", kind: "", by: "", text: "" },
        ])
    })
})
