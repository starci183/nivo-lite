import { PublicApiErrorCode } from "./errors/public-api.error"
import {
    SOURCE_CHARS_MAX,
    checkContent,
    cleanTags,
    clampLimit,
    contactParts,
    eventsSince,
    dedupePrefix,
    leadFacts,
    messageDedupeSuffix,
    normaliseContact,
    trimmedField,
    visibilityOf,
} from "./public-api.policy"

const NOW = new Date("2026-10-12T10:00:00.000Z")

describe("public-api policy", () => {
    describe("normaliseContact", () => {
        it("turns a Vietnamese phone into 84 digits however it is written", () => {
            expect(normaliseContact("0912 000 701")).toBe("84912000701")
            expect(normaliseContact("+84 912 000 701")).toBe("84912000701")
            expect(normaliseContact("912000701")).toBe("84912000701")
        })

        it("lowercases an email", () => {
            expect(normaliseContact(" A@Example.COM ")).toBe("a@example.com")
        })

        it("answers null for nothing, blanks and text without digits", () => {
            expect(normaliseContact(undefined)).toBeNull()
            expect(normaliseContact(null)).toBeNull()
            expect(normaliseContact("   ")).toBeNull()
            expect(normaliseContact("abc")).toBeNull()
        })
    })

    describe("contactParts", () => {
        it("puts a phone in phone and an email in email", () => {
            expect(contactParts("0912000701")).toEqual({ phone: "84912000701", email: null })
            expect(contactParts("a@b.co")).toEqual({ phone: null, email: "a@b.co" })
            expect(contactParts(null)).toEqual({ phone: null, email: null })
        })
    })

    describe("dedupePrefix", () => {
        it("names the kind of request and the key that sent it", () => {
            expect(dedupePrefix("lead", "key-1")).toBe("lead:key-1:")
            expect(dedupePrefix("message", "key-2")).toBe("message:key-2:")
        })
    })

    describe("messageDedupeSuffix", () => {
        it("is the same for the same idempotency key and conversation and differs otherwise", () => {
            const suffix = messageDedupeSuffix("idem-1", "conv-1")

            expect(suffix).toMatch(/^[0-9a-f]{24}$/)
            expect(messageDedupeSuffix(" idem-1 ", "conv-1")).toBe(suffix)
            expect(messageDedupeSuffix("idem-2", "conv-1")).not.toBe(suffix)
            expect(messageDedupeSuffix("idem-1", "conv-2")).not.toBe(suffix)
        })

        it("is empty without an idempotency key", () => {
            expect(messageDedupeSuffix(undefined, "conv-1")).toBe("")
            expect(messageDedupeSuffix("   ", "conv-1")).toBe("")
        })
    })

    describe("eventsSince", () => {
        it("reads the caller's time as ISO", () => {
            expect(eventsSince("2026-10-01T00:00:00Z", NOW)).toEqual({ kind: "ok", value: "2026-10-01T00:00:00.000Z" })
        })

        it("goes one day back when the caller names no time", () => {
            expect(eventsSince(undefined, NOW)).toEqual({ kind: "ok", value: "2026-10-11T10:00:00.000Z" })
        })

        it("refuses a time that is not one", () => {
            expect(eventsSince("yesterday", NOW)).toMatchObject({
                kind: "refused",
                code: PublicApiErrorCode.SinceInvalid,
            })
        })
    })

    describe("cleanTags", () => {
        it("trims, clips, drops blanks and keeps twelve", () => {
            const many = Array.from({ length: 15 }, (_, index) => `tag-${index}`)

            expect(cleanTags([" a ", "", "  ", "x".repeat(50)])).toEqual(["a", "x".repeat(40)])
            expect(cleanTags(many)).toHaveLength(12)
        })
    })

    describe("checkContent", () => {
        it("accepts a source up to the limit and refuses a longer one", () => {
            expect(checkContent("text")).toEqual({ kind: "ok", value: "text" })
            expect(checkContent("x".repeat(SOURCE_CHARS_MAX)).kind).toBe("ok")
            expect(checkContent("x".repeat(SOURCE_CHARS_MAX + 1))).toEqual({
                kind: "refused",
                code: PublicApiErrorCode.ContentTooLong,
                params: { max: SOURCE_CHARS_MAX },
            })
        })
    })

    describe("clampLimit", () => {
        it("keeps a number inside the bounds, clamps one outside and falls back for the rest", () => {
            expect(clampLimit("20", 50, 200)).toBe(20)
            expect(clampLimit("9999", 50, 200)).toBe(200)
            expect(clampLimit("-5", 50, 200)).toBe(1)
            expect(clampLimit("abc", 50, 200)).toBe(50)
            expect(clampLimit("0", 50, 200)).toBe(50)
            expect(clampLimit(undefined, 100, 500)).toBe(100)
        })
    })

    describe("leadFacts", () => {
        it("makes every absent text empty, defaults the channel to the API and drops an empty stage", () => {
            expect(leadFacts({ authorization: undefined, name: "A", stage: "" })).toEqual({
                name: "A",
                phone: "",
                email: "",
                company: "",
                need: "",
                channel: "API",
                externalId: "",
                note: "",
                stage: null,
            })
        })

        it("keeps what the caller sent", () => {
            expect(
                leadFacts({
                    authorization: undefined,
                    name: "A",
                    phone: "1",
                    email: "e",
                    company: "c",
                    need: "n",
                    channel: "Zalo",
                    externalId: "x",
                    note: "t",
                    stage: "won",
                }),
            ).toEqual({
                name: "A",
                phone: "1",
                email: "e",
                company: "c",
                need: "n",
                channel: "Zalo",
                externalId: "x",
                note: "t",
                stage: "won",
            })
        })
    })

    describe("visibilityOf", () => {
        it("is public only when the caller says public", () => {
            const base = { authorization: undefined, title: "t", content: "c" }

            expect(visibilityOf({ ...base, visibility: "public" })).toBe("public")
            expect(visibilityOf({ ...base, visibility: "secret" })).toBe("internal")
            expect(visibilityOf(base)).toBe("internal")
        })
    })

    describe("trimmedField", () => {
        it("trims a string, reads a number as its digits and leaves anything else alone", () => {
            expect(trimmedField("  a b ")).toBe("a b")
            expect(trimmedField(901234567)).toBe("901234567")
            expect(trimmedField(true)).toBe(true)
            expect(trimmedField(undefined)).toBeUndefined()
        })
    })
})
