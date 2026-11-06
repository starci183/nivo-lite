import { Test } from "@nestjs/testing"
import { jsonValueOf } from "./json-value.policy"

const SUBJECT = Symbol("json-value.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { jsonValueOf } }],
    }).compile()
    return moduleRef.get<{ jsonValueOf: typeof jsonValueOf }>(SUBJECT)
}

describe("jsonValueOf", () => {
    it("keeps scalars, arrays and nested objects as they are", async () => {
        const { jsonValueOf } = await buildSubject()
        expect(jsonValueOf({ a: 1, b: [true, null, "x"], c: { d: "e" } })).toEqual({
            json: { a: 1, b: [true, null, "x"], c: { d: "e" } },
            valid: true,
        })
    })

    it("leaves out a member that is undefined", async () => {
        const { jsonValueOf } = await buildSubject()
        expect(jsonValueOf({ a: 1, b: undefined })).toEqual({ json: { a: 1 }, valid: true })
    })

    it("says what JSON cannot carry is not valid", async () => {
        const { jsonValueOf } = await buildSubject()
        expect(jsonValueOf(Number.NaN).valid).toBe(false)
        expect(jsonValueOf(() => 1).valid).toBe(false)
        expect(jsonValueOf([1, () => 1])).toEqual({ json: [1, null], valid: false })
        expect(jsonValueOf({ a: () => 1 }).valid).toBe(false)
    })
})
