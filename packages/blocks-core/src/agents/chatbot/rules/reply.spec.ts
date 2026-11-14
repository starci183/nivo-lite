import { REPLY_MAX, replyBodyOf } from "./reply"

describe("replyBodyOf", () => {
    it("trims the draft", () => {
        expect(replyBodyOf("  Hello  ")).toEqual({ ok: true, text: "Hello" })
    })

    it("refuses an empty or blank draft", () => {
        expect(replyBodyOf("")).toEqual({ ok: false, reason: "empty" })
        expect(replyBodyOf(" \n ")).toEqual({ ok: false, reason: "empty" })
    })

    it("accepts a reply of the longest length and refuses one character more", () => {
        expect(replyBodyOf("a".repeat(REPLY_MAX))).toEqual({ ok: true, text: "a".repeat(REPLY_MAX) })
        expect(replyBodyOf("a".repeat(REPLY_MAX + 1))).toEqual({ ok: false, reason: "too_long" })
    })
})
