import { HOUR_MS, INSTAGRAM_MAX_BYTES, MESSENGER_MAX_CHARS } from "./meta.contracts"
import { classifyGraphError } from "./meta-failure.policy"
import { checkMessagingWindow, checkPrivateReply, chunkText, createRateLimiter } from "./meta-window.policy"

const NOW = 1_800_000_000_000

describe("checkMessagingWindow", () => {
    it("refuses a person who never wrote", () => {
        expect(checkMessagingWindow(null, NOW)).toEqual({ ok: false, reason: "no_user_message" })
    })

    it("allows a response inside 24 hours", () => {
        expect(checkMessagingWindow(NOW - 23 * HOUR_MS, NOW)).toEqual({ ok: true, via: "standard" })
    })

    it("refuses after 24 hours unless the human agent tag is passed, then up to 7 days", () => {
        expect(checkMessagingWindow(NOW - 25 * HOUR_MS, NOW)).toEqual({ ok: false, reason: "window_expired" })
        expect(checkMessagingWindow(NOW - 25 * HOUR_MS, NOW, "HUMAN_AGENT")).toEqual({ ok: true, via: "human_agent" })
        expect(checkMessagingWindow(NOW - 8 * 24 * HOUR_MS, NOW, "HUMAN_AGENT")).toEqual({
            ok: false,
            reason: "human_agent_expired",
        })
    })
})

describe("checkPrivateReply", () => {
    it("allows one reply inside 7 days", () => {
        expect(checkPrivateReply(NOW - HOUR_MS, false, NOW)).toEqual({ ok: true })
        expect(checkPrivateReply(NOW - 8 * 24 * HOUR_MS, false, NOW)).toEqual({
            ok: false,
            reason: "private_reply_expired",
        })
    })

    it("refuses a second reply and an unknown comment age", () => {
        expect(checkPrivateReply(NOW, true, NOW)).toEqual({ ok: false, reason: "already_replied" })
        expect(checkPrivateReply(null, false, NOW)).toEqual({ ok: false, reason: "comment_age_unknown" })
    })
})

describe("chunkText", () => {
    it("keeps a short text whole and drops empty text", () => {
        expect(chunkText("facebook", "  hello  ")).toEqual(["hello"])
        expect(chunkText("facebook", "   ")).toEqual([])
    })

    it("splits a long Messenger text at a space inside the limit", () => {
        const text = `${"word ".repeat(600)}end`
        const chunks = chunkText("facebook", text)

        expect(chunks.length).toBeGreaterThan(1)
        expect(chunks.every((chunk) => chunk.length <= MESSENGER_MAX_CHARS)).toBe(true)
        expect(chunks.join(" ").replace(/\s+/gu, " ")).toBe(text.replace(/\s+/gu, " "))
    })

    it("splits by bytes on Instagram and cuts a text with no break where it must", () => {
        const accented = "\u00e9".repeat(900)
        const chunks = chunkText("instagram", accented)

        expect(chunks.length).toBeGreaterThan(1)
        expect(chunks.every((chunk) => Buffer.byteLength(chunk, "utf8") <= INSTAGRAM_MAX_BYTES)).toBe(true)
        expect(chunks.join("")).toBe(accented)
    })
})

describe("createRateLimiter", () => {
    it("allows max hits per window and frees the slot after it", () => {
        const limiter = createRateLimiter(2, 1000)

        expect(limiter.take("page", 0)).toBe(true)
        expect(limiter.take("page", 10)).toBe(true)
        expect(limiter.take("page", 20)).toBe(false)
        expect(limiter.take("other", 20)).toBe(true)
        expect(limiter.take("page", 1005)).toBe(true)
    })
})

describe("classifyGraphError", () => {
    it.each([
        [{ code: 190 }, "token"],
        [{ status: 401 }, "token"],
        [{ code: 4 }, "rate_limited"],
        [{ code: 80006 }, "rate_limited"],
        [{ status: 429 }, "rate_limited"],
        [{ code: 10, subcode: 2018278 }, "window_expired"],
        [{ code: 551 }, "recipient_unavailable"],
        [{ code: 100, subcode: 2018001 }, "recipient_unavailable"],
        [{ subcode: 2018108 }, "recipient_unavailable"],
        [{ code: 10 }, "permission"],
        [{ code: 230 }, "permission"],
        [{ message: "This comment was already replied to privately" }, "already_replied"],
        [{ code: 100, subcode: 33 }, "not_found"],
        [{ code: 100, status: 404 }, "not_found"],
        [{ code: 100 }, "error"],
        [{}, "error"],
    ] as const)("classifies %j as %s", (facts, expected) => {
        expect(classifyGraphError(facts)).toBe(expected)
    })
})
