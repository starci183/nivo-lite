import { payloadOf } from "./flow-payload.policy"

describe("payloadOf", () => {
    it("copies the entries of the inputs", () => {
        const payload = { a: 1, b: { c: 2 } }

        const copy = payloadOf(payload)

        expect(copy).toEqual(payload)
        expect(copy).not.toBe(payload)
    })
})
