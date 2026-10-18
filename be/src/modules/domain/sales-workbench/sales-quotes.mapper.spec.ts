import { Test } from "@nestjs/testing"
import { itemOf, quote } from "../../../tests/fixtures/builders/sales-workbench.builder"
import { quotesByLeadOf } from "./sales-quotes.mapper"

const SUBJECT = Symbol("sales-quotes.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { quotesByLeadOf } }],
    }).compile()
    return moduleRef.get<typeof import("./sales-quotes.mapper")>(SUBJECT)
}

describe("quotesByLeadOf", () => {
    it("retains the first eligible quote per customer in input order", async () => {
        const subject = await build()
        const result = subject.quotesByLeadOf([
            itemOf({ lead_id: "first", status: "rejected", proposal: quote(900) }),
            itemOf({ lead_id: "first", proposal: quote(100) }),
            itemOf({ lead_id: "second", proposal: quote(200) }),
            itemOf({ lead_id: "first", proposal: quote(300) }),
        ])
        expect([...result]).toEqual([
            ["first", 100],
            ["second", 200],
        ])
    })

    it("ignores non-quotes, missing customers and absent amounts", async () => {
        const subject = await build()
        expect(
            subject.quotesByLeadOf([
                itemOf({ action: "follow_up", proposal: quote(100) }),
                itemOf({ lead_id: null, proposal: quote(100) }),
                itemOf({ lead_id: "", proposal: quote(100) }),
                itemOf({ proposal: quote(null) }),
                itemOf({ proposal: quote() }),
            ]).size,
        ).toBe(0)
    })

    it("preserves zero and nonfinite numeric amounts without introducing validation", async () => {
        const subject = await build()
        const result = subject.quotesByLeadOf([
            itemOf({ lead_id: "zero", proposal: quote(0) }),
            itemOf({ lead_id: "nan", proposal: quote(Number.NaN) }),
        ])
        expect(result.get("zero")).toBe(0)
        expect(result.get("nan")).toBeNaN()
    })
})
