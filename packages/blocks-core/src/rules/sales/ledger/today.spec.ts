import { TRANSACTION } from "./accounting.fixtures"
import { INBOX_PATH, TODAY_HINT_KEYS, ownerQueueOf, todayFiguresOf, todayRangeOf } from "./today"
import type { OwnerQueueWords } from "./today"

const WORDS: OwnerQueueWords = {
    unmatched: "Unmatched",
    question: "Question",
    inbox: "Inbox",
    paymentTitle: (amount) => `${amount} open`,
}

describe("the day of the shop", () => {
    it("starts at midnight on the shop wall and lasts a day", () => {
        expect(todayRangeOf(new Date("2026-11-04T11:30:00.000Z"))).toEqual({
            fromIso: "2026-11-03T17:00:00.000Z",
            toIso: "2026-11-04T17:00:00.000Z",
        })
    })

    it("belongs to the next calendar day after 17:00 UTC", () => {
        expect(todayRangeOf(new Date("2026-11-04T18:00:00.000Z")).fromIso).toBe("2026-11-04T17:00:00.000Z")
    })
})

describe("the figures of today", () => {
    it("add up the money received and count what waits, questions included", () => {
        const figures = todayFiguresOf({
            received: { vnd: 6_450_000, count: 14 },
            matched: { vnd: 5_250_000, count: 12 },
            unmatched: { vnd: 1_200_000, count: 1 },
            waitingQuestions: 2,
        })
        expect(figures).toMatchObject({ receivedVnd: 6_450_000, matchedCount: 12, unmatchedCount: 1, waitingCount: 3 })
        expect(figures.receivedHint).toEqual({ key: TODAY_HINT_KEYS.received, values: { count: 14 } })
        expect(figures.waitingHint).toEqual({ key: TODAY_HINT_KEYS.waiting, values: { questions: 2 } })
        expect(JSON.stringify(figures.unmatchedHint)).toContain("1.200.000")
    })
})

describe("the queue of what waits for the owner", () => {
    const payment = { ...TRANSACTION, payer: "A", reference: "R" }
    const question = { id: "q1", text: "How much?", source: "#1088", askedAt: "2026-11-04T01:00:00.000Z" }

    it("lists the payments, then the questions, and links to the Inbox", () => {
        const queue = ownerQueueOf([payment], [question], 2, WORDS)
        expect(queue.count).toBe("2")
        expect(queue.more).toEqual({ label: "Inbox", href: INBOX_PATH })
        expect(queue.rows.map((row) => row.id)).toEqual([payment.id, "q1"])
        expect(queue.rows[0]).toMatchObject({ badges: [{ label: "Unmatched", tone: "warning" }], description: "A \u00b7 R" })
        expect(queue.rows[0]?.primary?.id).toBe("assign-order")
        expect(queue.rows[1]).toMatchObject({ primary: null, edit: { id: "edit" }, draft: { answer: "" } })
    })

    it("leads a payment, not a question, with the logo it is given", () => {
        const queue = ownerQueueOf([payment], [question], 2, WORDS, "/logo.png")
        expect(queue.rows[0]).toMatchObject({ logo: "/logo.png" })
        expect(queue.rows[1]).not.toHaveProperty("logo")
    })

    it("has no count and no link when nothing waits", () => {
        expect(ownerQueueOf([], [], 0, WORDS)).toEqual({ count: null, more: null, rows: [] })
    })

    it("leaves a payment with no payer or reference without a description", () => {
        const bare = { ...TRANSACTION, payer: null, reference: null }
        expect(ownerQueueOf([bare], [], 1, WORDS).rows[0]?.description).toBe("")
    })
})
