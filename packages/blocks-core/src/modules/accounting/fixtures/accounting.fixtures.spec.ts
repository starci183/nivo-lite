import { accountingModule, paymentModule } from "../declaration"
import {
    ACCOUNTING_FIXTURES,
    CLOSE_BLOCKED,
    CLOSE_READY,
    CLOSE_WAITING,
    ENTRY_COUNTS,
    ENTRY_COUNTS_NONE,
    ENTRY_DETAIL,
    ENTRY_ROWS,
    FIGURES_NONE,
    FIGURES_VIEW,
    PAYMENT_FIXTURES,
} from "./accounting.fixtures"

describe("accounting fixtures", () => {
    it("covers every read and every action of both modules", () => {
        expect(Object.keys(ACCOUNTING_FIXTURES.reads).sort()).toEqual(
            accountingModule.reads.map((read) => read.id).sort(),
        )
        expect(Object.keys(ACCOUNTING_FIXTURES.actions)).toEqual(accountingModule.actions.map((action) => action.id))
        expect(Object.keys(PAYMENT_FIXTURES.actions)).toEqual(paymentModule.actions.map((action) => action.id))
        expect(PAYMENT_FIXTURES.reads).toEqual({})
    })

    it("has an empty state for every list, count, record and figure read, and a waiting one for the close check", () => {
        for (const [id, fixture] of Object.entries(ACCOUNTING_FIXTURES.reads))
            expect([id, "empty" in fixture || "waiting" in fixture]).toEqual([id, true])
        expect(ACCOUNTING_FIXTURES.reads["accounting.close-check"]?.waiting).toBe(CLOSE_WAITING)
    })

    it("has ready data that is what the reads yield", () => {
        expect(ENTRY_ROWS.map((row) => row.kind)).toEqual(["income", "adjustment", "invoice"])
        expect(ENTRY_COUNTS.total).toBe(ENTRY_ROWS.length)
        expect(ENTRY_COUNTS_NONE.total).toBe(0)
        expect(ENTRY_DETAIL.lineage.map((step) => step.kind)).toEqual(["order", "payment", "adjustment"])
        expect(FIGURES_VIEW.income).toEqual({ vnd: 5_000_000, count: 1 })
        expect(FIGURES_VIEW.ageing.d0.vnd).toBe(2_000_000)
        expect(FIGURES_NONE.receivable).toEqual({ vnd: 0, count: 0 })
    })

    it("shows a period blocked every way, one that waits only for the owner and one that may close", () => {
        expect(CLOSE_BLOCKED.blockers).toEqual(["unmatched_payments", "waiting_questions"])
        expect(CLOSE_WAITING.blockers).toEqual(["waiting_questions"])
        expect(CLOSE_READY.canClose).toBe(true)
    })
})
