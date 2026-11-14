import { ACCOUNTING_JOBS } from "./accounting-jobs"

describe("ACCOUNTING_JOBS", () => {
    it("holds the ledger line and the book entry, each once by its module name", () => {
        expect(ACCOUNTING_JOBS.map((job) => job.name)).toEqual([
            "sales.ledger-append",
            "sales.book-project",
        ])
    })
})
