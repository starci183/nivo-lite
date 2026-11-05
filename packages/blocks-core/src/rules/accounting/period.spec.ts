import { closeVerdict, PERIOD_KEYS, periodOf } from "./period"

const NOW = new Date("2026-11-04T11:30:00.000Z")

describe("period", () => {
    it("lists this period and the last", () => {
        expect(PERIOD_KEYS).toEqual(["this", "last"])
    })

    it("spans the shop calendar month, from its first instant to the first of the next", () => {
        expect(periodOf(NOW, "this")).toEqual({
            key: "this",
            fromIso: "2026-10-31T17:00:00.000Z",
            toIso: "2026-11-30T17:00:00.000Z",
            fromDay: "2026-11-01",
            toDay: "2026-12-01",
        })
        expect(periodOf(NOW, "last")).toMatchObject({ key: "last", fromDay: "2026-10-01", toDay: "2026-11-01" })
    })

    it("lets a period close once it is over, with every payment tied and no question waiting", () => {
        expect(
            closeVerdict({ period: periodOf(NOW, "last"), now: NOW, unmatchedPayments: 0, waitingQuestions: 0 }),
        ).toEqual({ canClose: true, blockers: [] })
    })

    it("keeps a period open while it runs, and lists everything else that stops it, in order", () => {
        expect(
            closeVerdict({ period: periodOf(NOW, "this"), now: NOW, unmatchedPayments: 2, waitingQuestions: 1 }),
        ).toEqual({ canClose: false, blockers: ["period_open", "unmatched_payments", "waiting_questions"] })
        expect(
            closeVerdict({ period: periodOf(NOW, "last"), now: NOW, unmatchedPayments: 0, waitingQuestions: 3 })
                .blockers,
        ).toEqual(["waiting_questions"])
    })

    it("closes a period at the very instant the next one starts", () => {
        const period = periodOf(NOW, "last")
        const at = new Date(period.toIso)
        expect(closeVerdict({ period, now: at, unmatchedPayments: 0, waitingQuestions: 0 }).canClose).toBe(true)
    })
})
