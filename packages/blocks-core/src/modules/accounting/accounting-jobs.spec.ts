import { ACCOUNTING_JOBS } from "./accounting-jobs"

describe("ACCOUNTING_JOBS", () => {
    it("holds the ledger line, the book entry, the notice and the re-match, each once by its module name", () => {
        expect(ACCOUNTING_JOBS.map((job) => job.name)).toEqual([
            "accounting.ledger-append",
            "accounting.book-project",
            "payment.confirm-notice",
            "payment.rematch",
        ])
    })
})
