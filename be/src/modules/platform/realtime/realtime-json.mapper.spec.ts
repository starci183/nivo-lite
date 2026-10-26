import { Test } from "@nestjs/testing"
import { parseJson } from "./realtime-json.mapper"

const SUBJECT: unique symbol = Symbol("realtime.json.mapper")

const buildSubject = async () => {
    const functions = { parseJson }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

describe("parseJson", () => {
    it("answers the value of a JSON text with no cause", async () => {
        const subject = await buildSubject()

        expect(subject.parseJson('{"a":1}')).toEqual({ value: { a: 1 }, cause: null })
    })

    it("answers the parse failure as the cause of a text that is not JSON", async () => {
        const subject = await buildSubject()
        const outcome = subject.parseJson("nope")

        expect(outcome.value).toBeUndefined()
        expect(outcome.cause).toBeInstanceOf(SyntaxError)
    })
})
