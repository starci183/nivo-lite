import { Test } from "@nestjs/testing"

import { HOUR_MS, INSTAGRAM_MAX_BYTES, MESSENGER_MAX_CHARS } from "./meta.contracts"

import { checkMessagingWindow, checkPrivateReply, chunkMessage, createRateLimiter } from "./meta-window.policy"

const POLICY = Symbol("./meta-window.policy")

type PolicySubject = {
    checkMessagingWindow: typeof checkMessagingWindow
    checkPrivateReply: typeof checkPrivateReply
    chunkMessage: typeof chunkMessage
    createRateLimiter: typeof createRateLimiter
}

const NOW = 1_800_000_000_000

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: POLICY,
                useValue: { checkMessagingWindow, checkPrivateReply, chunkMessage, createRateLimiter },
            },
        ],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)

    return { subject }
}

describe("checkMessagingWindow", () => {
    it("refuses a person who never wrote", async () => {
        const { subject } = await buildSubject()

        expect(subject.checkMessagingWindow(null, NOW)).toEqual({ ok: false, reason: "no_user_message" })
    })

    it("allows a response inside 24 hours", async () => {
        const { subject } = await buildSubject()

        expect(subject.checkMessagingWindow(NOW - 23 * HOUR_MS, NOW)).toEqual({ ok: true, via: "standard" })
    })

    it("refuses after 24 hours unless the human agent tag is passed, then up to 7 days", async () => {
        const { subject } = await buildSubject()

        expect(subject.checkMessagingWindow(NOW - 25 * HOUR_MS, NOW)).toEqual({
            ok: false,
            reason: "window_expired",
        })
        expect(subject.checkMessagingWindow(NOW - 25 * HOUR_MS, NOW, "HUMAN_AGENT")).toEqual({
            ok: true,
            via: "human_agent",
        })
        expect(subject.checkMessagingWindow(NOW - 8 * 24 * HOUR_MS, NOW, "HUMAN_AGENT")).toEqual({
            ok: false,
            reason: "human_agent_expired",
        })
    })
})

describe("checkPrivateReply", () => {
    it("allows one reply inside 7 days", async () => {
        const { subject } = await buildSubject()

        expect(subject.checkPrivateReply(NOW - HOUR_MS, false, NOW)).toEqual({ ok: true })
        expect(subject.checkPrivateReply(NOW - 8 * 24 * HOUR_MS, false, NOW)).toEqual({
            ok: false,
            reason: "private_reply_expired",
        })
    })

    it("refuses a second reply and an unknown comment age", async () => {
        const { subject } = await buildSubject()

        expect(subject.checkPrivateReply(NOW, true, NOW)).toEqual({ ok: false, reason: "already_replied" })
        expect(subject.checkPrivateReply(null, false, NOW)).toEqual({ ok: false, reason: "comment_age_unknown" })
    })
})

describe("chunkMessage", () => {
    it("keeps a short text whole and drops empty text", async () => {
        const { subject } = await buildSubject()

        expect(subject.chunkMessage("facebook", "  hello  ")).toEqual(["hello"])
        expect(subject.chunkMessage("facebook", "   ")).toEqual([])
    })

    it("splits a long Messenger text at a space inside the limit", async () => {
        const { subject } = await buildSubject()

        const text = `${"word ".repeat(600)}end`
        const chunks = subject.chunkMessage("facebook", text)

        expect(chunks.length).toBeGreaterThan(1)
        expect(chunks.every((chunk) => chunk.length <= MESSENGER_MAX_CHARS)).toBe(true)
        expect(chunks.join(" ").replace(/\s+/gu, " ")).toBe(text.replace(/\s+/gu, " "))
    })

    it("splits by bytes on Instagram and cuts a text with no break where it must", async () => {
        const { subject } = await buildSubject()

        const accented = "\u00e9".repeat(900)
        const chunks = subject.chunkMessage("instagram", accented)

        expect(chunks.length).toBeGreaterThan(1)
        expect(chunks.every((chunk) => Buffer.byteLength(chunk, "utf8") <= INSTAGRAM_MAX_BYTES)).toBe(true)
        expect(chunks.join("")).toBe(accented)
    })
})

describe("createRateLimiter", () => {
    it("allows max hits per window and frees the slot after it", async () => {
        const { subject } = await buildSubject()

        const limiter = subject.createRateLimiter(2, 1000)

        expect(limiter.take("page", 0)).toBe(true)
        expect(limiter.take("page", 10)).toBe(true)
        expect(limiter.take("page", 20)).toBe(false)
        expect(limiter.take("other", 20)).toBe(true)
        expect(limiter.take("page", 1005)).toBe(true)
    })
})
