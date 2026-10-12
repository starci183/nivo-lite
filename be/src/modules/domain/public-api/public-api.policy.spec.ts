import { PublicApiErrorCode } from "./errors/public-api.error"
import {
    SOURCE_CHARS_MAX,
    checkContent,
    cleanTags,
    contactParts,
    eventsSince,
    leadDedupeKey,
    leadEventId,
    messageDedupeKey,
    normaliseContact,
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

    describe("lead keys", () => {
        it("names the event after the key and the caller's external id, or a fresh id without one", () => {
            expect(leadEventId("key-1", "crm-9", "fresh")).toBe("api:key-1:crm-9")
            expect(leadEventId("key-1", "", "fresh")).toBe("api:key-1:fresh")
            expect(leadDedupeKey("api:key-1:crm-9")).toBe("manual:lead:api:key-1:crm-9")
        })
    })

    describe("messageDedupeKey", () => {
        it("is the same for the same key, idempotency key and conversation and differs otherwise", () => {
            const key = messageDedupeKey("key-1", "idem-1", "conv-1")

            expect(key).toMatch(/^api:message:key-1:[0-9a-f]{24}$/)
            expect(messageDedupeKey("key-1", "idem-1", "conv-1")).toBe(key)
            expect(messageDedupeKey("key-1", "idem-2", "conv-1")).not.toBe(key)
            expect(messageDedupeKey("key-1", "idem-1", "conv-2")).not.toBe(key)
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
            expect(eventsSince("yesterday", NOW)).toMatchObject({ kind: "refused", code: PublicApiErrorCode.SinceInvalid })
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
})
