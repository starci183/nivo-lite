import { Test } from "@nestjs/testing"
import { payloadOf } from "./flow-payload.policy"

const SUBJECT = Symbol("flow-payload.policy")
type Subject = { payloadOf: typeof payloadOf }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { payloadOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("payloadOf", () => {
    it("copies the entries of the inputs", async () => {
        const subject = await build()

        const payload = { a: 1, b: { c: 2 } }

        const copy = subject.payloadOf(payload)

        expect(copy).toEqual(payload)
        expect(copy).not.toBe(payload)
    })
})
