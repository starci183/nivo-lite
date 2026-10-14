import {
    RECENTLY_PAID_MS,
    clipText,
    handoffTranscriptOf,
    isRecentlyPaid,
    latestQuestionOf,
    sameItems,
} from "./customer-turn.policy"

const NOW = new Date("2026-10-14T00:00:00.000Z")

describe("clipText", () => {
    it("keeps a text that fits and ellipsizes one that does not", () => {
        expect(clipText("tea", 3)).toBe("tea")
        expect(clipText("tea ", 4)).toBe("tea ")
        expect(clipText("  tea cup  ", 6)).toBe("  tea\u2026")
    })
})

describe("sameItems", () => {
    it("treats case, spacing and composed letters as the same item", () => {
        expect(sameItems("Tr\u00e0  s\u1eefa", "tra\u0300 sua")).toBe(true)
        expect(sameItems("Tra sua", "Tra da")).toBe(false)
    })
})

describe("isRecentlyPaid", () => {
    it("is true only inside the recent window", () => {
        const paid = new Date(NOW.getTime() - RECENTLY_PAID_MS + 1).toISOString()
        const boundary = new Date(NOW.getTime() - RECENTLY_PAID_MS).toISOString()
        expect(isRecentlyPaid(paid, NOW)).toBe(true)
        expect(isRecentlyPaid(boundary, NOW)).toBe(false)
        expect(isRecentlyPaid(null, NOW)).toBe(false)
    })
})

describe("latestQuestionOf", () => {
    it("uses the latest customer line, else the turn body", () => {
        expect(
            latestQuestionOf(
                [
                    { role: "user", body: "Price?" },
                    { role: "agent", body: "50k" },
                    { role: "user", body: "Hours?" },
                ],
                "fallback",
            ),
        ).toBe("Hours?")
        expect(latestQuestionOf([{ role: "agent", body: "Hello" }], "fallback")).toBe("fallback")
    })
})

describe("handoffTranscriptOf", () => {
    it("labels the customer and the agent, including the reply about to leave", () => {
        expect(
            handoffTranscriptOf(
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
