import { Test } from "@nestjs/testing"
import { isValidTaxCode, normalizeTaxCode, sameTaxCode } from "./tax-code.policy"

const SUBJECT = Symbol("tax-code.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isValidTaxCode, normalizeTaxCode, sameTaxCode } }],
    }).compile()
    return moduleRef.get<typeof import("./tax-code.policy")>(SUBJECT)
}

describe("tax-code.policy", () => {
    it("accepts enterprise codes whose check digit holds, branch codes and personal ids", async () => {
        const subject = await build()

        expect(subject.isValidTaxCode("0100109106")).toBe(true)
        expect(subject.isValidTaxCode(" 0100109106-001 ")).toBe(true)
        expect(subject.isValidTaxCode("0100109106001")).toBe(true)
        expect(subject.isValidTaxCode("001203004567")).toBe(true)
    })

    it("rejects a wrong check digit and malformed codes", async () => {
        const subject = await build()

        expect(subject.isValidTaxCode("0100109105")).toBe(false)
        expect(subject.isValidTaxCode("01001091")).toBe(false)
        expect(subject.isValidTaxCode("01001O9106")).toBe(false)
        expect(subject.isValidTaxCode("")).toBe(false)
    })

    it("compares codes ignoring separators and never matches blanks", async () => {
        const subject = await build()

        expect(subject.normalizeTaxCode("0100 109.106-001")).toBe("0100109106001")
        expect(subject.sameTaxCode("0100109106-001", "0100109106001")).toBe(true)
        expect(subject.sameTaxCode("0100109106", "0108896128")).toBe(false)
        expect(subject.sameTaxCode("", "")).toBe(false)
    })
})
