import { Test } from "@nestjs/testing"
import { listedPayable, payableRow } from "../../../tests/fixtures/builders/supplier-payables.builder"
import { isStale, supplierPayableKey } from "./supplier-payable.policy"

const SUBJECT = Symbol("supplier-payable.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isStale, supplierPayableKey } }],
    }).compile()
    return moduleRef.get<{ isStale: typeof isStale; supplierPayableKey: typeof supplierPayableKey }>(SUBJECT)
}

describe("supplier-payable.policy", () => {
    it("keys an invoice by the seller tax code and the invoice number", async () => {
        const subject = await build()

        expect(subject.supplierPayableKey(listedPayable())).toBe("0100109106:17")
    })

    it("calls an open row stale when the amount, the dates or the supplier changed", async () => {
        const subject = await build()

        expect(subject.isStale(payableRow(), listedPayable())).toBe(false)
        expect(subject.isStale(payableRow(), listedPayable({ amountVnd: 1 }))).toBe(true)
        expect(subject.isStale(payableRow(), listedPayable({ dueOn: "2026-11-02" }))).toBe(true)
        expect(subject.isStale(payableRow(), listedPayable({ issuedOn: "2026-10-02" }))).toBe(true)
        expect(subject.isStale(payableRow(), listedPayable({ supplier: "Other" }))).toBe(true)
    })

    it("never calls a paid row stale", async () => {
        const subject = await build()

        expect(subject.isStale(payableRow({ status: "paid" }), listedPayable({ amountVnd: 1 }))).toBe(false)
    })
})
