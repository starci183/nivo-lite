import { Test } from "@nestjs/testing"
import { PublicApiErrorCode } from "./errors/public-api.error"
import {
    MESSAGE_AUTO_SEND_WINDOW_MS,
    SOURCE_CHARS_MAX,
    dedupePrefix as realDedupePrefix,
    messageDedupeSuffix as realMessageDedupeSuffix,
    eventsSince as realEventsSince,
    isStaleMessageAdmission as realIsStaleMessageAdmission,
    cleanTags as realCleanTags,
    checkContent as realCheckContent,
    clampLimit as realClampLimit,
    visibilityOf as realVisibilityOf,
    trimmedField as realTrimmedField,
} from "./public-api.policy"

const SUBJECT = Symbol("public-api.policy")

type Subject = Pick<
    typeof import("./public-api.policy"),
    | "dedupePrefix"
    | "messageDedupeSuffix"
    | "eventsSince"
    | "isStaleMessageAdmission"
    | "cleanTags"
    | "checkContent"
    | "clampLimit"
    | "visibilityOf"
    | "trimmedField"
>

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    dedupePrefix: realDedupePrefix,
                    messageDedupeSuffix: realMessageDedupeSuffix,
                    eventsSince: realEventsSince,
                    isStaleMessageAdmission: realIsStaleMessageAdmission,
                    cleanTags: realCleanTags,
                    checkContent: realCheckContent,
                    clampLimit: realClampLimit,
                    visibilityOf: realVisibilityOf,
                    trimmedField: realTrimmedField,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = new Date("2026-10-12T10:00:00.000Z")

describe("public-api policy / dedupePrefix", () => {
    it("names the kind of request and the key that sent it", async () => {
        const subject = await build()

        expect(subject.dedupePrefix("knowledge", "key-1")).toBe("knowledge:key-1:")
        expect(subject.dedupePrefix("message", "key-2")).toBe("message:key-2:")
    })
})

describe("public-api policy / messageDedupeSuffix", () => {
    it("is the same for the same idempotency key and conversation and differs otherwise", async () => {
        const subject = await build()

        const suffix = subject.messageDedupeSuffix("idem-1", "conv-1")

        expect(suffix).toMatch(/^[0-9a-f]{24}$/)
        expect(subject.messageDedupeSuffix(" idem-1 ", "conv-1")).toBe(suffix)
        expect(subject.messageDedupeSuffix("idem-2", "conv-1")).not.toBe(suffix)
        expect(subject.messageDedupeSuffix("idem-1", "conv-2")).not.toBe(suffix)
    })
    it("is empty without an idempotency key", async () => {
        const subject = await build()

        expect(subject.messageDedupeSuffix(undefined, "conv-1")).toBe("")
        expect(subject.messageDedupeSuffix("   ", "conv-1")).toBe("")
    })
})

describe("public-api policy / eventsSince", () => {
    it("reads the caller's time as ISO", async () => {
        const subject = await build()

        expect(subject.eventsSince("2026-10-01T00:00:00Z", NOW)).toEqual({
            kind: "ok",
            value: "2026-10-01T00:00:00.000Z",
        })
    })
    it("goes one day back when the caller names no time", async () => {
        const subject = await build()

        expect(subject.eventsSince(undefined, NOW)).toEqual({ kind: "ok", value: "2026-10-11T10:00:00.000Z" })
    })
    it("refuses a time that is not one", async () => {
        const subject = await build()

        expect(subject.eventsSince("yesterday", NOW)).toMatchObject({
            kind: "refused",
            code: PublicApiErrorCode.SinceInvalid,
        })
    })
})

describe("public-api policy / isStaleMessageAdmission", () => {
    it("keeps a message inside its 24-hour auto-send window up to the window's last millisecond", async () => {
        const subject = await build()

        expect(MESSAGE_AUTO_SEND_WINDOW_MS).toBe(24 * 60 * 60 * 1000)
        expect(subject.isStaleMessageAdmission(NOW, NOW)).toBe(false)
        expect(subject.isStaleMessageAdmission(new Date("2026-10-11T10:00:00.000Z"), NOW)).toBe(false)
    })
    it("marks a message admitted longer ago, or at an unknown time, as stale", async () => {
        const subject = await build()

        expect(subject.isStaleMessageAdmission(new Date("2026-10-11T09:59:59.999Z"), NOW)).toBe(true)
        expect(subject.isStaleMessageAdmission(null, NOW)).toBe(true)
    })
})

describe("public-api policy / cleanTags", () => {
    it("trims, clips, drops blanks and keeps twelve", async () => {
        const subject = await build()

        const many = Array.from({ length: 15 }, (_, index) => `tag-${index}`)

        expect(subject.cleanTags([" a ", "", "  ", "x".repeat(50)])).toEqual(["a", "x".repeat(40)])
        expect(subject.cleanTags(many)).toHaveLength(12)
    })
})

describe("public-api policy / checkContent", () => {
    it("accepts a source up to the limit and refuses a longer one", async () => {
        const subject = await build()

        expect(subject.checkContent("text")).toEqual({ kind: "ok", value: "text" })
        expect(subject.checkContent("x".repeat(SOURCE_CHARS_MAX)).kind).toBe("ok")
        expect(subject.checkContent("x".repeat(SOURCE_CHARS_MAX + 1))).toEqual({
            kind: "refused",
            code: PublicApiErrorCode.ContentTooLong,
            params: { max: SOURCE_CHARS_MAX },
        })
    })
})

describe("public-api policy / clampLimit", () => {
    it("keeps a number inside the bounds, clamps one outside and falls back for the rest", async () => {
        const subject = await build()

        expect(subject.clampLimit("20", 50, 200)).toBe(20)
        expect(subject.clampLimit("9999", 50, 200)).toBe(200)
        expect(subject.clampLimit("-5", 50, 200)).toBe(1)
        expect(subject.clampLimit("abc", 50, 200)).toBe(50)
        expect(subject.clampLimit("0", 50, 200)).toBe(50)
        expect(subject.clampLimit(undefined, 100, 500)).toBe(100)
    })
})

describe("public-api policy / visibilityOf", () => {
    it("is always internal, whatever the caller says", async () => {
        const subject = await build()

        expect(subject.visibilityOf()).toBe("internal")
    })
})

describe("public-api policy / trimmedField", () => {
    it("trims a string, reads a number as its digits and leaves anything else alone", async () => {
        const subject = await build()

        expect(subject.trimmedField("  a b ")).toBe("a b")
        expect(subject.trimmedField(901234567)).toBe("901234567")
        expect(subject.trimmedField(true)).toBe(true)
        expect(subject.trimmedField(undefined)).toBeUndefined()
    })
})
