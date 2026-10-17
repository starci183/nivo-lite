import { Test } from "@nestjs/testing"
import {
    readContentVariants,
    readContentMedia,
    readContentLinks,
    readContentEvidence,
    readContentPublished,
} from "./content-editor-json.mapper"

const SUBJECT = Symbol("content-editor-json.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    readContentVariants,
                    readContentMedia,
                    readContentLinks,
                    readContentEvidence,
                    readContentPublished,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./content-editor-json.mapper")>(SUBJECT)
}

describe("content editor historical JSON readers", () => {
    it.each([undefined, null, 1, "invalid", []])("ignores malformed channel maps: %p", async (value) => {
        const subject = await build()

        expect(subject.readContentVariants(value)).toEqual({})
        expect(subject.readContentPublished(value)).toEqual({})
    })
})

describe("content editor historical JSON readers", () => {
    it("selects supported channel objects and fills missing variant fields", async () => {
        const subject = await build()

        expect(
            subject.readContentVariants({
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
})

describe("content editor historical JSON readers", () => {
    it("selects supported publication proofs and defaults malformed members", async () => {
        const subject = await build()

        expect(
            subject.readContentPublished({
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
})

describe("content editor historical JSON readers", () => {
    it.each([undefined, null, {}, "invalid"])("defaults malformed collections: %p", async (value) => {
        const subject = await build()

        expect(subject.readContentMedia(value)).toEqual([])
        expect(subject.readContentLinks(value)).toEqual([])
        expect(subject.readContentEvidence(value)).toEqual([])
    })
})

describe("content editor historical JSON readers", () => {
    it("normalizes attachments and omits malformed array elements", async () => {
        const subject = await build()

        expect(
            subject.readContentMedia([
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
})

describe("content editor historical JSON readers", () => {
    it("preserves link and audit text while defaulting invalid fields", async () => {
        const subject = await build()

        expect(
            subject.readContentLinks([null, [], 1, { url: "https://example.test", label: "Source" }, { url: null }]),
        ).toEqual([
            { url: "https://example.test", label: "Source" },
            { url: "", label: "" },
        ])
        expect(
            subject.readContentEvidence([
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
