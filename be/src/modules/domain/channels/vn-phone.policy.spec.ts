import { Test } from "@nestjs/testing"
import { normaliseVnPhone } from "./vn-phone.policy"

const SUBJECT = Symbol("vn-phone.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { normaliseVnPhone } }],
    }).compile()
    return moduleRef.get<typeof import("./vn-phone.policy")>(SUBJECT)
}

describe("normaliseVnPhone", () => {
    it.each([
        ["0912345678", "84912345678"],
        ["0912 345 678", "84912345678"],
        ["091.234.5678", "84912345678"],
        ["(091) 234-5678", "84912345678"],
        ["+84912345678", "84912345678"],
        ["+84 912 345 678", "84912345678"],
        ["0084912345678", "84912345678"],
        ["84912345678", "84912345678"],
        ["912345678", "84912345678"],
        [" 0387 654 321 ", "84387654321"],
    ])("reads %p as %p", async (raw, phone) => {
        const subject = await build()

        expect(subject.normaliseVnPhone(raw)).toBe(phone)
    })

    it.each([
        ["an empty text", ""],
        ["null", null],
        ["undefined", undefined],
        ["letters", "call me"],
        ["a plus inside the number", "84+912345678"],
        ["too few digits", "091234567"],
        ["too many digits", "09123456789"],
        ["a zero after the country code", "84012345678"],
        ["a landline", "0283 822 1234"],
        ["a number outside the mobile ranges", "0212345678"],
        ["another country", "+6591234567"],
    ])("answers null for %s", async (_label, raw) => {
        const subject = await build()

        expect(subject.normaliseVnPhone(raw)).toBeNull()
    })
})
