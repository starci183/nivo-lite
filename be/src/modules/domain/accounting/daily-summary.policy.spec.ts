import { Test } from "@nestjs/testing"
import type { DailySummaryInput, UpcomingDue } from "./accounting-desk.contracts"
import { bankCounts, buildDailySummary, dueLine, summaryHubCard } from "./daily-summary.policy"
import { CARD_COPY, SUMMARY_COPY, kindText } from "./messages/accounting-desk.messages"

const SUBJECT = Symbol("daily-summary.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { bankCounts, buildDailySummary, dueLine, summaryHubCard } }],
    }).compile()
    return moduleRef.get<typeof import("./daily-summary.policy")>(SUBJECT)
}

const due = (daysLeft: number, kind: UpcomingDue["kind"] = "vat"): UpcomingDue => ({
    source: kind === "supplier_payment" ? "supplier" : "tax",
    kind,
    ref: "2026-Q3",
    dueOn: "2026-11-02",
    daysLeft,
    amountVnd: null,
    note: "",
})

const input = (overrides: Partial<DailySummaryInput> = {}): DailySummaryInput => ({
    day: "2026-10-20",
    valid: 38,
    needsReview: 3,
    invalidTaxCode: 1,
    matched: 18,
    unmatched: 1,
    upcoming: [due(-2, "supplier_payment"), due(13), due(20), due(21), due(22), due(23)],
    ...overrides,
})

describe("daily-summary.policy", () => {
    it("builds the card with the counts, the bank line and the next deadline", async () => {
        const subject = await build()

        const card = subject.buildDailySummary(input())

        expect(card).toEqual(
            expect.objectContaining({
                kind: "daily_summary",
                room: "accounting",
                day: "2026-10-20",
                stats: { valid: 38, needsReview: 3, invalidTaxCode: 1 },
                bank: { matched: 18, unmatched: 1 },
                next: due(13),
            }),
        )
        expect(card.upcoming).toHaveLength(5)
        expect(card.text).toBe(
            [
                SUMMARY_COPY.headline(5),
                SUMMARY_COPY.stats(input()),
                SUMMARY_COPY.bank(input()),
                SUMMARY_COPY.next(due(13), kindText("vat")),
            ].join("\n"),
        )
        expect(subject.dueLine(due(3))).toBe(SUMMARY_COPY.next(due(3), kindText("vat")))
    })

    it("says when nothing is due", async () => {
        const subject = await build()

        const quiet = subject.buildDailySummary(
            input({ needsReview: 0, invalidTaxCode: 0, unmatched: 0, upcoming: [] }),
        )

        expect(quiet.next).toBeNull()
        expect(quiet.headline).toBe(SUMMARY_COPY.headline(0))
        expect(quiet.text.endsWith(SUMMARY_COPY.none)).toBe(true)
    })

    it("carries the tiles as fields and the next dues as lines in the hub card", async () => {
        const subject = await build()

        const card = subject.buildDailySummary(input())

        expect(card.hub).toEqual(
            expect.objectContaining({
                v: 1,
                type: "daily_summary",
                title: CARD_COPY.summaryTitle,
                subtitle: "2026-10-20",
            }),
        )
        expect(card.hub.fields?.map((field) => field.value)).toEqual(["38", "3", "1", "18", "1"])
        expect(card.hub.lines?.[1]).toEqual({ at: "2026-11-02", text: CARD_COPY.dueAt(due(13), kindText("vat")) })
        expect(card.hub.lines).toHaveLength(5)
    })

    it("counts the matched credits, those a folio just took, and those still waiting", async () => {
        const subject = await build()
        const credit = (matched: boolean) => ({ bankTxnRef: "r", content: "", amountVnd: 1, occurredAt: "", matched })

        expect(subject.bankCounts([credit(true), credit(false), credit(false), credit(false)], 1)).toEqual({
            matched: 2,
            unmatched: 2,
        })
    })
})
