import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import { acceptWordsOf, bytesText, refreshWaitOf, fileItemsOf, fileKindOf, fileLimitsOf, fileProblemOf, fileRefOf, roomOf } from "./file-field"

const LIMITS = { accept: ["audio/*", "video/mp4"], maxBytes: 1000, max: null }

/** A record type with one single and one list file field, as a package declares them. */
const SHOP = defineEntity({
    name: "fixture.shop-product",
    dataKind: "fixture-shop-product",
    fields: {
        cover: field.file({ accept: ["image/*"], maxBytes: 5000 }),
        photos: field.file({ accept: ["image/png", "image/webp"], maxBytes: 4000, many: true, max: 3 }),
    },
})

/** The limits of a field the fixture declares (a field it does not declare would fail its spec below). */
const declared = (field: string) =>
    fileLimitsOf("fixture.shop-product", field, [SHOP]) ?? { accept: [], maxBytes: 0, max: null }

const ITEM = (n: number) => ({ key: `ws/fixture.shop-product/r1/photos/o${n}`, mime: "image/png", size: 10, name: `p${n}.png` })

describe("fileLimitsOf", () => {
    it("reads the accepted types and the size limit from the entity declaration of a file field", () => {
        expect(fileLimitsOf("blocks-core.video.render", "voice")).toEqual({ accept: ["audio/*"], maxBytes: 20 * 1024 * 1024, max: null })
        expect(fileLimitsOf("blocks-core.video.render", "clips")).toMatchObject({ accept: ["video/mp4", "video/webm"], max: 12 })
    })

    it("is null for a field that is no file field, a field that is not declared and a type that is not declared", () => {
        expect(fileLimitsOf("blocks-core.video.render", "state")).toBeNull()
        expect(fileLimitsOf("blocks-core.video.render", "nope")).toBeNull()
        expect(fileLimitsOf("video.nope", "voice")).toBeNull()
    })
})

describe("fileRefOf", () => {
    it("takes a stored reference and nothing else", () => {
        const ref = { key: "ws/blocks-core.video.render/r1/video/o1", mime: "video/mp4", size: 5, name: "cut.mp4" }
        expect(fileRefOf(ref)).toEqual(ref)
        expect(fileRefOf(null)).toBeNull()
        expect(fileRefOf({ ...ref, key: "../x" })).toBeNull()
        expect(fileRefOf("cut.mp4")).toBeNull()
    })
})

describe("fileProblemOf", () => {
    it("lets a file the field accepts through", () => {
        expect(fileProblemOf(LIMITS, { type: "audio/mpeg", size: 10 })).toBeNull()
        expect(fileProblemOf(LIMITS, { type: "video/mp4", size: 1000 })).toBeNull()
        expect(fileProblemOf(LIMITS, { type: "Audio/MPEG; codecs=x", size: 10 })).toBeNull()
    })

    it("names an empty file, a type the field does not accept and a file over the limit", () => {
        expect(fileProblemOf(LIMITS, { type: "audio/mpeg", size: 0 })).toBe("empty")
        expect(fileProblemOf(LIMITS, { type: "video/webm", size: 10 })).toBe("type")
        expect(fileProblemOf(LIMITS, { type: "", size: 10 })).toBe("type")
        expect(fileProblemOf(LIMITS, { type: "audio/mpeg", size: 1001 })).toBe("size")
    })
})

describe("fileKindOf", () => {
    it("shows an image as a picture, a video in a player and everything else, audio included, as a file to open", () => {
        expect(fileKindOf("image/png")).toBe("image")
        expect(fileKindOf("video/mp4")).toBe("video")
        expect(fileKindOf("audio/mpeg")).toBe("other")
        expect(fileKindOf("application/pdf")).toBe("other")
    })
})

describe("bytesText", () => {
    it("names a size in the unit that keeps it short", () => {
        expect(bytesText(512, "en")).toMatch(/^512\s?B$/iu)
        expect(bytesText(2048, "en")).toMatch(/^2\s?kB$/iu)
        expect(bytesText(5 * 1024 * 1024, "en")).toMatch(/^5\s?MB$/iu)
        expect(bytesText(1.5 * 1024 * 1024 * 1024, "en")).toMatch(/^1\.5\s?GB$/iu)
    })
})

describe("acceptWordsOf", () => {
    it("words a family by the word given for it and an exact type by its subtype", () => {
        expect(acceptWordsOf(["image/*", "video/mp4"], { image: "images" })).toBe("images, MP4")
    })

    it("keeps a family with no word and a long subtype as the declaration wrote them", () => {
        expect(acceptWordsOf(["font/*"], {})).toBe("font/*")
        const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        expect(acceptWordsOf([docx], {})).toBe(docx)
    })
})

describe("refreshWaitOf", () => {
    it("waits until 30 seconds before the address expires, never less than 5 seconds", () => {
        const now = Date.parse("2026-01-01T00:00:00Z")
        expect(refreshWaitOf("2026-01-01T00:05:00Z", now)).toBe(270_000)
        expect(refreshWaitOf("2026-01-01T00:00:10Z", now)).toBe(5_000)
        expect(refreshWaitOf("2025-01-01T00:00:00Z", now)).toBe(5_000)
    })

    it("waits five minutes when the expiry cannot be read", () => {
        expect(refreshWaitOf("soon", 0)).toBe(300_000)
    })
})

describe("a list file field", () => {
    it("reads its maximum and its limits from the declaration, and a single field has none", () => {
        expect(fileLimitsOf("fixture.shop-product", "photos", [SHOP])).toEqual({ accept: ["image/png", "image/webp"], maxBytes: 4000, max: 3 })
        expect(fileLimitsOf("fixture.shop-product", "cover", [SHOP])).toEqual({ accept: ["image/*"], maxBytes: 5000, max: null })
        expect(fileLimitsOf("fixture.shop-product", "photos")).toBeNull()
    })

    it("names the references a record holds in order, and none for anything that is no reference", () => {
        const list = declared("photos")
        const single = declared("cover")
        expect(fileItemsOf(list, [ITEM(2), ITEM(1)]).map((ref) => ref.name)).toEqual(["p2.png", "p1.png"])
        expect(fileItemsOf(list, [])).toEqual([])
        expect(fileItemsOf(list, null)).toEqual([])
        expect(fileItemsOf(list, ITEM(1))).toEqual([])
        expect(fileItemsOf(list, [{ ...ITEM(1), key: "../x" }])).toEqual([])
        expect(fileItemsOf(single, ITEM(1))).toEqual([ITEM(1)])
        expect(fileItemsOf(single, null)).toEqual([])
    })

    it("counts the room left: the maximum less what it holds, zero when full and for a field of one file", () => {
        const list = declared("photos")
        const single = declared("cover")
        expect(roomOf(list, 0)).toBe(3)
        expect(roomOf(list, 2)).toBe(1)
        expect(roomOf(list, 3)).toBe(0)
        expect(roomOf(single, 0)).toBe(0)
    })
})
