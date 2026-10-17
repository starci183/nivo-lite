import { Test } from "@nestjs/testing"
import { firstBooleanResult } from "./boolean-result.mapper"
const SUBJECT = Symbol("boolean-result.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { firstBooleanResult } }],
    }).compile()
    return moduleRef.get<typeof import("./boolean-result.mapper")>(SUBJECT)
}

describe("firstBooleanResult", () => {
    it("is true only when the first row's value is exactly true", async () => {
        const subject = await build()

        expect(subject.firstBooleanResult([])).toBe(false)
        expect(subject.firstBooleanResult([{ value: false }, { value: true }])).toBe(false)
        expect(subject.firstBooleanResult([{ value: true }])).toBe(true)
    })
})
