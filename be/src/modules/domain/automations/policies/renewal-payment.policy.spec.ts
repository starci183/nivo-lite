import { Test } from "@nestjs/testing"
import { dongDigits, isBillableAmount, transferContentOf } from "./renewal-payment.policy"

const POLICY = Symbol("./renewal-payment.policy")
type PolicySubject = {
    isBillableAmount: typeof isBillableAmount
    transferContentOf: typeof transferContentOf
    dongDigits: typeof dongDigits
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { isBillableAmount, transferContentOf, dongDigits } }],
    }).compile()
    return moduleRef.get<PolicySubject>(POLICY)
}

describe("renewal payment", () => {
    it("bills only a positive, finite amount", async () => {
        const subject = await buildSubject()

        expect(subject.isBillableAmount(1_620_000)).toBe(true)
        expect(subject.isBillableAmount(0)).toBe(false)
        expect(subject.isBillableAmount(-5)).toBe(false)
        expect(subject.isBillableAmount(null)).toBe(false)
        expect(subject.isBillableAmount(Number.NaN)).toBe(false)
    })

    it("turns an invoice number into a bank-safe transfer content: letters and digits, upper case", async () => {
        const subject = await buildSubject()

        expect(subject.transferContentOf("INV-202611-0003")).toBe("INV2026110003")
        expect(subject.transferContentOf("inv 2026/11_0004")).toBe("INV2026110004")
    })

    it("groups the digits of an amount the Vietnamese way", async () => {
        const subject = await buildSubject()

        expect(subject.dongDigits(1_620_000)).toBe("1.620.000")
        expect(subject.dongDigits(500)).toBe("500")
    })
})
