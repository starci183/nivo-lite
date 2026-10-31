import { Test } from "@nestjs/testing"
import { bigintOfNumber, numberOfBigint } from "./bigint-number.mapper"

const SUBJECT = Symbol("bigint-number.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { bigintOfNumber, numberOfBigint } }],
    }).compile()
    return moduleRef.get<typeof import("./bigint-number.mapper")>(SUBJECT)
}

describe("bigint number mapper", () => {
    it("reads the driver's text as a number and keeps null", async () => {
        const subject = await build()
        expect(subject.numberOfBigint("1250000")).toBe(1250000)
        expect(subject.numberOfBigint(null)).toBeNull()
    })

    it("writes the number, or its absence, back unchanged", async () => {
        const subject = await build()
        expect(subject.bigintOfNumber(42)).toBe(42)
        expect(subject.bigintOfNumber(null)).toBeNull()
        expect(subject.bigintOfNumber(undefined)).toBeUndefined()
    })
})
