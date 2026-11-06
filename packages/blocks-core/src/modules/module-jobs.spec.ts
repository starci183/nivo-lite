import { jobProblems } from "@nivo-lite/agent-sdk/mutation"
import { MODULE_JOBS } from "./module-jobs"

describe("MODULE_JOBS", () => {
    it("holds each job once, by its module name", () => {
        const names = MODULE_JOBS.map((job) => job.name)
        expect(new Set(names).size).toBe(names.length)
        expect(names).toEqual([
            "chatbot.deliver-reply",
            "accounting.ledger-append",
            "accounting.book-project",
            "payment.confirm-notice",
            "payment.rematch",
        ])
    })

    it("holds jobs whose declaration has no problem", () => {
        expect(MODULE_JOBS.flatMap((job) => jobProblems(job))).toEqual([])
    })
})
