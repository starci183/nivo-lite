import { Test } from "@nestjs/testing"
import {
    RECENTLY_PAID_MS,
    STALE_WAKE_MS,
    clipText,
    handoffTranscriptOf,
    holdReasonOf,
    isRecentlyPaid,
    isStaleWake,
    latestQuestionOf,
    sameItems,
    turnRefOf,
} from "./customer-turn.policy"

type Subject = {
    clipText: typeof clipText
    sameItems: typeof sameItems
    isRecentlyPaid: typeof isRecentlyPaid
    latestQuestionOf: typeof latestQuestionOf
    handoffTranscriptOf: typeof handoffTranscriptOf
    isStaleWake: typeof isStaleWake
    holdReasonOf: typeof holdReasonOf
    turnRefOf: typeof turnRefOf
}

const SUBJECT = Symbol("customer-turn.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    clipText,
                    sameItems,
                    isRecentlyPaid,
                    latestQuestionOf,
                    handoffTranscriptOf,
                    isStaleWake,
                    holdReasonOf,
                    turnRefOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = new Date("2026-10-14T00:00:00.000Z")

describe("clipText", () => {
    it("keeps a text that fits and ellipsizes one that does not", async () => {
        const subject = await build()

        expect(subject.clipText("tea", 3)).toBe("tea")
        expect(subject.clipText("tea ", 4)).toBe("tea ")
        expect(subject.clipText("  tea cup  ", 6)).toBe("  tea\u2026")
    })
})

describe("sameItems", () => {
    it("treats case, spacing and composed letters as the same item", async () => {
        const subject = await build()

        expect(subject.sameItems("Tr\u00e0  s\u1eefa", "tra\u0300 su\u031b\u0303a")).toBe(true)
        expect(subject.sameItems("Tr\u00e0  s\u1eefa", "tra\u0300 sua")).toBe(false)
        expect(subject.sameItems("Tra sua", "Tra da")).toBe(false)
    })
})

describe("isRecentlyPaid", () => {
    it("is true only inside the recent window", async () => {
        const subject = await build()

        const paid = new Date(NOW.getTime() - RECENTLY_PAID_MS + 1).toISOString()
        const boundary = new Date(NOW.getTime() - RECENTLY_PAID_MS).toISOString()
        expect(subject.isRecentlyPaid(paid, NOW)).toBe(true)
        expect(subject.isRecentlyPaid(boundary, NOW)).toBe(false)
        expect(subject.isRecentlyPaid(null, NOW)).toBe(false)
    })
})

describe("latestQuestionOf", () => {
    it("uses the latest customer line, else the turn body", async () => {
        const subject = await build()

        expect(
            subject.latestQuestionOf(
                [
                    { role: "user", body: "Price?" },
                    { role: "agent", body: "50k" },
                    { role: "user", body: "Hours?" },
                ],
                "fallback",
            ),
        ).toBe("Hours?")
        expect(subject.latestQuestionOf([{ role: "agent", body: "Hello" }], "fallback")).toBe("fallback")
    })
})

describe("handoffTranscriptOf", () => {
    it("labels the customer and the agent, including the reply about to leave", async () => {
        const subject = await build()

        expect(
            subject.handoffTranscriptOf(
                [
                    { role: "user", body: "I need tea" },
                    { role: "agent", body: "Which size?" },
                ],
                "Noted",
                "Lan",
                "Bot",
            ),
        ).toBe("Lan: I need tea\nBot: Which size?\nBot: Noted")
    })
})

describe("isStaleWake", () => {
    it("is stale only after ten minutes", async () => {
        const subject = await build()

        expect(subject.isStaleWake(new Date(NOW.getTime() - STALE_WAKE_MS), NOW)).toBe(false)
        expect(subject.isStaleWake(new Date(NOW.getTime() - STALE_WAKE_MS - 1), NOW)).toBe(true)
        expect(subject.isStaleWake(NOW, NOW)).toBe(false)
    })
})

describe("holdReasonOf", () => {
    it("maps what the executor and the drain say to what the legacy road says", async () => {
        const subject = await build()

        expect(subject.holdReasonOf("quota")).toBe("quota_exceeded")
        expect(subject.holdReasonOf("breaker")).toBe("openclaw_unavailable")
        expect(subject.holdReasonOf("openclaw_unavailable")).toBe("openclaw_unavailable")
        expect(subject.holdReasonOf("openclaw_not_configured")).toBe("openclaw_not_configured")
        expect(subject.holdReasonOf("killed")).toBe("installation_not_running")
        expect(subject.holdReasonOf("stale")).toBe("stale_wake")
    })

    it("keeps a reason the legacy road already knows", async () => {
        const subject = await build()

        expect(subject.holdReasonOf("needs_connection")).toBe("needs_connection")
        expect(subject.holdReasonOf("installation_not_running")).toBe("installation_not_running")
    })
})

describe("turnRefOf", () => {
    it("reads the message a wake answers", async () => {
        const subject = await build()

        expect(
            subject.turnRefOf({
                conversationId: "conv-1",
                messageId: "msg-1",
                channelEventId: "tg:1:2",
                lookupName: true,
            }),
        ).toEqual({ conversationId: "conv-1", messageId: "msg-1", channelEventId: "tg:1:2" })
    })

    it("is null when any of the three ids is missing", async () => {
        const subject = await build()

        expect(subject.turnRefOf({ messageId: "msg-1", channelEventId: "x" })).toBeNull()
        expect(subject.turnRefOf({ conversationId: "conv-1", channelEventId: "x" })).toBeNull()
        expect(subject.turnRefOf({ conversationId: "conv-1", messageId: "msg-1" })).toBeNull()
        expect(subject.turnRefOf({})).toBeNull()
    })
})
