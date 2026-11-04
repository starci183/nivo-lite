import { Test } from "@nestjs/testing"
import { valuesOf } from "./parameter-values.policy"

const SUBJECT = Symbol("parameter-values.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { valuesOf } }],
    }).compile()
    return moduleRef.get<{ valuesOf: typeof valuesOf }>(SUBJECT)
}

describe("parameter-values.policy", () => {
    it("keeps the numbers, texts and yes or no the buyer gave and drops every other member", async () => {
        const subject = await build()

        const values = subject.valuesOf({ limit: 5, shop: "Spa", auto: true, nested: { a: 1 }, none: null, list: [1] })

        expect(values).toEqual({ limit: 5, shop: "Spa", auto: true })
    })

    it("reads a value that is not an object, a text or nothing at all, as no values", async () => {
        const subject = await build()

        expect(subject.valuesOf("text")).toEqual({})
        expect(subject.valuesOf(null)).toEqual({})
    })
})
