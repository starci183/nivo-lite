import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import type { AddSourceInput } from "./knowledge-sources.contracts"
import {
    NOW,
    metaChanges,
    tagsOf,
    normalizeSource,
    normalizeUpdate,
    replacementContent,
    replacementUpload,
    safeFileName,
    uploadVerdict,
} from "./source-input.policy"

const SUBJECT = Symbol("source-input.policy")
type Subject = {
    tagsOf: typeof tagsOf
    normalizeSource: typeof normalizeSource
    normalizeUpdate: typeof normalizeUpdate
    metaChanges: typeof metaChanges
    replacementContent: typeof replacementContent
    safeFileName: typeof safeFileName
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    tagsOf,
                    normalizeSource,
                    normalizeUpdate,
                    metaChanges,
                    replacementContent,
                    safeFileName,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const WS = "11111111-1111-4111-8111-111111111111"

const inputOf = builder<AddSourceInput>({
    kind: "text",
    title: "Hours",
    content: "Open 8 to 21",
    visibility: "internal",
})

describe("normalizeSource audience", () => {
    it.each([
        ["missing", undefined],
        ["unknown", "other"],
        ["empty", ""],
        ["internal", "internal"],
    ])(
        "adds a source whose audience is %s as internal: there is no picker, the part of the Brain decides",
        async (_name, visibility) => {
            const subject = await buildSubject()

            expect(subject.normalizeSource(WS, inputOf({ visibility }))).toMatchObject({
                kind: "ok",
                value: { visibility: "internal" },
            })
        },
    )
})

describe("normalizeSource", () => {
    it("tidies a note", async () => {
        const subject = await buildSubject()

        expect(
            subject.normalizeSource(
                WS,
                inputOf({
                    title: "  Hours  ",
                    content: " Open 8 to 21 ",
                    topic: " Opening ",
                    tags: [" a ", "a", "", "b"],
                    module: "chatbot",
                    installationId: "inst-1",
                    visibility: "internal",
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
                visibility: "internal",
                origin: "ZIP",
            },
        })
    })

    it("keeps empty optional fields of a Q&A list null", async () => {
        const subject = await buildSubject()

        expect(
            subject.normalizeSource(WS, inputOf({ kind: "faq", topic: "  ", module: "", visibility: "internal" })),
        ).toMatchObject({
            kind: "ok",
            value: { kind: "faq", topic: null, module: null, visibility: "internal", origin: null },
        })
    })

    it("keeps the address of a link as its content and titles it from the address", async () => {
        const subject = await buildSubject()

        expect(
            subject.normalizeSource(WS, inputOf({ kind: "url", title: "", url: " https://shop.test/menu " })),
        ).toMatchObject({
            kind: "ok",
            value: {
                kind: "url",
                title: "shop.test/menu",
                content: "https://shop.test/menu",
                sourceUrl: "https://shop.test/menu",
            },
        })
    })

    it("keeps the storage object of a file and titles it from the file name", async () => {
        const subject = await buildSubject()

        const storagePath = `${WS}/22222222-2222-4222-8222-222222222222/price-list.v2.pdf`

        expect(
            subject.normalizeSource(WS, inputOf({ kind: "file", title: "", storagePath, content: undefined })),
        ).toMatchObject({
            kind: "ok",
            value: { kind: "file", title: "price-list.v2", content: "", storagePath },
        })
    })
})

describe("normalizeSource", () => {
    it.each([
        ["an unknown kind", inputOf({ kind: "audio" }), KnowledgeSourcesErrorCode.SourceKindUnknown],
        [
            "a public document, which only an approved public document is",
            inputOf({ visibility: "public" }),
            KnowledgeSourcesErrorCode.PublicByApproval,
        ],
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
    ])("refuses %s", async (_name, input, code) => {
        const subject = await buildSubject()

        expect(subject.normalizeSource(WS, input)).toMatchObject({ kind: "refused", code })
    })
})

describe("normalizeUpdate", () => {
    it("keeps what is not given and tidies what is", async () => {
        const subject = await buildSubject()

        expect(subject.normalizeUpdate({ sourceId: "s" })).toEqual({
            kind: "ok",
            value: { title: null, topic: null, tags: null, module: null, visibility: null },
        })
        expect(
            subject.normalizeUpdate({
                sourceId: "s",
                title: " T ",
                topic: " x ",
                tags: ["a", "a"],
                module: " m ",
            }),
        ).toEqual({ kind: "ok", value: { title: "T", topic: "x", tags: ["a"], module: "m", visibility: null } })
    })

    it("refuses to make a document public", async () => {
        const subject = await buildSubject()

        expect(subject.normalizeUpdate({ sourceId: "s", visibility: "public" })).toMatchObject({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.PublicByApproval,
        })
    })

    it("clears a topic and a module with an empty text and names an empty title", async () => {
        const subject = await buildSubject()

        expect(
            subject.normalizeUpdate({ sourceId: "s", title: " ", topic: "", module: "", visibility: "internal" }),
        ).toEqual({
            kind: "ok",
            value: { title: "Untitled", topic: "", tags: null, module: "", visibility: "internal" },
        })
    })
})

describe("replacementContent", () => {
    it("keeps the text when none is given and trims a given one", async () => {
        const subject = await buildSubject()

        expect(subject.replacementContent(undefined)).toEqual({ kind: "ok", value: null })
        expect(subject.replacementContent(" new ")).toEqual({ kind: "ok", value: "new" })
    })

    it("refuses an empty or too long text", async () => {
        const subject = await buildSubject()

        expect(subject.replacementContent(" ")).toMatchObject({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.ContentEmpty,
        })
        expect(subject.replacementContent("a".repeat(120_001))).toMatchObject({
            kind: "refused",
            code: KnowledgeSourcesErrorCode.ContentTooLong,
        })
    })
})

describe("tagsOf", () => {
    it("answers no tags for none, cuts each to forty characters and keeps twelve", async () => {
        const subject = await buildSubject()

        expect(subject.tagsOf(undefined)).toEqual([])
        expect(subject.tagsOf(["x".repeat(50)])[0]).toHaveLength(40)
        expect(subject.tagsOf(Array.from({ length: 20 }, (_, index) => `t${index}`))).toHaveLength(12)
    })
})

describe("safeFileName", () => {
    it.each([
        ["__a__b___", "a__b"],
        ["_".repeat(10000), "file"],
        [`__${String.fromCodePoint(0x110, 0x111)}__.txt__`, "Dd__.txt"],
    ])("trims boundary underscores in %s", async (name, expected) => {
        const subject = await buildSubject()

        expect(subject.safeFileName(name)).toBe(expected)
    })

    it("drops folders, marks and spaces", async () => {
        const subject = await buildSubject()

        expect(subject.safeFileName("C:\\docs\\B\u1ea3ng gi\u00e1 \u0111\u1ed3 u\u1ed1ng.pdf")).toBe(
            "Bang_gia_do_uong.pdf",
        )
        expect(subject.safeFileName("\u0110a.txt")).toBe("Da.txt")
    })

    it("names an empty name file and keeps the last 120 characters", async () => {
        const subject = await buildSubject()

        expect(subject.safeFileName("///")).toBe("file")
        expect(subject.safeFileName(`${"a".repeat(200)}.pdf`)).toHaveLength(120)
    })
})

/** Any function: the database instant a change carries. */
const anyFunction: unknown = expect.any(Function)

describe("metaChanges", () => {
    it("writes only what the change names, and the instant of the change", async () => {
        const subject = await buildSubject()
        const none = { title: null, topic: null, tags: null, module: null, visibility: null }

        expect(subject.metaChanges(none)).toEqual({ updatedAt: anyFunction })
        expect(
            subject.metaChanges({ title: "T", topic: "x", tags: ["a"], module: "m", visibility: "internal" }),
        ).toEqual({
            title: "T",
            topic: "x",
            tags: ["a"],
            module: "m",
            visibility: "internal",
            updatedAt: anyFunction,
        })
    })

    it("clears a topic and a module that are empty text", async () => {
        const subject = await buildSubject()

        expect(subject.metaChanges({ title: null, topic: "", tags: null, module: "", visibility: null })).toEqual({
            topic: null,
            module: null,
            updatedAt: anyFunction,
        })
    })
})

describe("NOW", () => {
    it("is the database instant", () => {
        expect(NOW()).toBe("now()")
    })
})

describe("replacementUpload and uploadVerdict", () => {
    const WORKSPACE = "11111111-1111-4111-8111-111111111111"

    it("takes a new upload inside the workspace, none when absent, and refuses one outside it", () => {
        expect(replacementUpload(WORKSPACE, undefined)).toEqual({ kind: "ok", value: null })
        expect(replacementUpload(WORKSPACE, ` ${WORKSPACE}/u/a.pdf `)).toEqual({
            kind: "ok",
            value: `${WORKSPACE}/u/a.pdf`,
        })
        expect(replacementUpload(WORKSPACE, `${WORKSPACE}/../x/a.pdf`)).toMatchObject({
            code: KnowledgeSourcesErrorCode.StoragePathInvalid,
        })
        expect(replacementUpload(WORKSPACE, "other/u/a.pdf")).toMatchObject({
            code: KnowledgeSourcesErrorCode.StoragePathInvalid,
        })
    })

    it("refuses an old Office file and a file over the limit at the door, and lets the rest through", () => {
        expect(uploadVerdict("Bang gia.XLS", null)).toMatchObject({ code: KnowledgeSourcesErrorCode.LegacyOffice })
        expect(uploadVerdict("slides.ppt", 10)).toMatchObject({ code: KnowledgeSourcesErrorCode.LegacyOffice })
        expect(uploadVerdict("scan.pdf", 52_428_801)).toMatchObject({
            code: KnowledgeSourcesErrorCode.FileTooLarge,
            params: { size: 50, max: 50 },
        })
        expect(uploadVerdict("scan.pdf", 52_428_800)).toEqual({ kind: "ok", value: null })
        expect(uploadVerdict("anh.jpg", null)).toEqual({ kind: "ok", value: null })
    })
})
