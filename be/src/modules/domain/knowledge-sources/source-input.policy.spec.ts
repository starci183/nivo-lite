import { builder } from "@starci/jest-preset"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import type { AddSourceInput } from "./knowledge-sources.contracts"
import { normalizeSource, normalizeUpdate, replacementContent, safeFileName, tagsOf } from "./source-input.policy"

const WS = "11111111-1111-4111-8111-111111111111"

const inputOf = builder<AddSourceInput>({ kind: "text", title: "Hours", content: "Open 8 to 21" })

describe("normalizeSource", () => {
    it("tidies a note", () => {
        expect(
            normalizeSource(
                WS,
                inputOf({
                    title: "  Hours  ",
                    content: " Open 8 to 21 ",
                    topic: " Opening ",
                    tags: [" a ", "a", "", "b"],
                    module: "chatbot",
                    installationId: "inst-1",
                    visibility: "public",
                    origin: "ZIP",
                }),
            ),
        ).toEqual({
            kind: "ok",
            value: {
                kind: "text",
                title: "Hours",
                content: "Open 8 to 21",
                storagePath: null,
                sourceUrl: null,
                topic: "Opening",
                tags: ["a", "b"],
                module: "chatbot",
                installationId: "inst-1",
                visibility: "public",
                origin: "ZIP",
            },
        })
    })

    it("keeps a Q&A list internal by default and empty optional fields null", () => {
        expect(
            normalizeSource(WS, inputOf({ kind: "faq", topic: "  ", module: "", visibility: "other" })),
        ).toMatchObject({
            kind: "ok",
            value: { kind: "faq", topic: null, module: null, visibility: "internal", origin: null },
        })
    })

    it("keeps the address of a link as its content and titles it from the address", () => {
        expect(normalizeSource(WS, inputOf({ kind: "url", title: "", url: " https://shop.test/menu " }))).toMatchObject(
            {
                kind: "ok",
                value: {
                    kind: "url",
                    title: "shop.test/menu",
                    content: "https://shop.test/menu",
                    sourceUrl: "https://shop.test/menu",
                },
            },
        )
    })

    it("keeps the storage object of a file and titles it from the file name", () => {
        const storagePath = `${WS}/22222222-2222-4222-8222-222222222222/price-list.v2.pdf`

        expect(
            normalizeSource(WS, inputOf({ kind: "file", title: "", storagePath, content: undefined })),
        ).toMatchObject({
            kind: "ok",
            value: { kind: "file", title: "price-list.v2", content: "", storagePath },
        })
    })

    it.each([
        ["an unknown kind", inputOf({ kind: "audio" }), KnowledgeSourcesErrorCode.SourceKindUnknown],
        ["a link that is not http", inputOf({ kind: "url", url: "ftp://x" }), KnowledgeSourcesErrorCode.UrlInvalid],
        [
            "a file outside the workspace",
            inputOf({ kind: "file", storagePath: "other/x.pdf" }),
            KnowledgeSourcesErrorCode.StoragePathInvalid,
        ],
        [
            "a file path that climbs",
            inputOf({ kind: "file", storagePath: `${WS}/../x.pdf` }),
            KnowledgeSourcesErrorCode.StoragePathInvalid,
        ],
        ["an empty note", inputOf({ content: "  " }), KnowledgeSourcesErrorCode.ContentEmpty],
        [
            "a note that is too long",
            inputOf({ content: "a".repeat(120_001) }),
            KnowledgeSourcesErrorCode.ContentTooLong,
        ],
        ["a note without a title", inputOf({ title: "  " }), KnowledgeSourcesErrorCode.TitleRequired],
    ])("refuses %s", (_name, input, code) => {
        expect(normalizeSource(WS, input)).toMatchObject({ kind: "refused", code })
    })
})

describe("normalizeUpdate", () => {
    it("keeps what is not given and tidies what is", () => {
        expect(normalizeUpdate({ sourceId: "s" })).toEqual({
            title: null,
            topic: null,
            tags: null,
            module: null,
            visibility: null,
        })
        expect(
            normalizeUpdate({
                sourceId: "s",
                title: " T ",
                topic: " x ",
                tags: ["a", "a"],
                module: " m ",
                visibility: "public",
            }),
        ).toEqual({ title: "T", topic: "x", tags: ["a"], module: "m", visibility: "public" })
    })

    it("clears a topic and a module with an empty text and names an empty title", () => {
        expect(normalizeUpdate({ sourceId: "s", title: " ", topic: "", module: "", visibility: "internal" })).toEqual({
            title: "Untitled",
            topic: "",
            tags: null,
            module: "",
            visibility: "internal",
        })
    })
})

describe("replacementContent", () => {
    it("keeps the text when none is given and trims a given one", () => {
        expect(replacementContent(undefined)).toEqual({ kind: "ok", value: null })
        expect(replacementContent(" new ")).toEqual({ kind: "ok", value: "new" })
    })

    it("refuses an empty or too long text", () => {
        expect(replacementContent(" ")).toMatchObject({ kind: "refused", code: KnowledgeSourcesErrorCode.ContentEmpty })
        expect(replacementContent("a".repeat(120_001))).toMatchObject({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.ContentTooLong,
        })
    })
})

describe("tagsOf", () => {
    it("answers no tags for none, cuts each to forty characters and keeps twelve", () => {
        expect(tagsOf(undefined)).toEqual([])
        expect(tagsOf(["x".repeat(50)])[0]).toHaveLength(40)
        expect(tagsOf(Array.from({ length: 20 }, (_, index) => `t${index}`))).toHaveLength(12)
    })
})

describe("safeFileName", () => {
    it("drops folders, marks and spaces", () => {
        expect(safeFileName("C:\\docs\\B\u1ea3ng gi\u00e1 \u0111\u1ed3 u\u1ed1ng.pdf")).toBe("Bang_gia_do_uong.pdf")
        expect(safeFileName("\u0110a.txt")).toBe("Da.txt")
    })

    it("names an empty name file and keeps the last 120 characters", () => {
        expect(safeFileName("///")).toBe("file")
        expect(safeFileName(`${"a".repeat(200)}.pdf`)).toHaveLength(120)
    })
})
