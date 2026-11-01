import { Test } from "@nestjs/testing"
import { maskPhones } from "./phone-mask.policy"

const SUBJECT = Symbol("phone-mask.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { maskPhones } }],
    }).compile()
    return moduleRef.get<typeof import("./phone-mask.policy")>(SUBJECT)
}

describe("phone-mask.policy", () => {
    it("masks a phone number in a title and keeps the words around it", async () => {
        const subject = await build()

        expect(subject.maskPhones("Hand Lan Tran (Acme, 0912345678) to Sales")).toBe(
            "Hand Lan Tran (Acme, 091xxxx678) to Sales",
        )
    })

    it("reads a spaced number and a country code as the same number", async () => {
        const subject = await build()

        expect(subject.maskPhones("call 091 234 5678")).toBe("call 091xxxx678")
        expect(subject.maskPhones("call +84 912 345 678")).toBe("call 091xxxx678")
    })

    it("leaves amounts, dates and short numbers alone", async () => {
        const subject = await build()

        expect(subject.maskPhones("Quote 150.000.000 on 2026-11-01 at 10:00")).toBe(
            "Quote 150.000.000 on 2026-11-01 at 10:00",
        )
        expect(subject.maskPhones("Order 12345")).toBe("Order 12345")
    })
})
