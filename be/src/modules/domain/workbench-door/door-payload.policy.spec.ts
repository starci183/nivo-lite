import { Test } from "@nestjs/testing"
import { PAYLOAD_MAX, parsePayload as realParsePayload } from "./door-payload.policy"

const SUBJECT = Symbol("door-payload.policy")

interface Subject {
    readonly parsePayload: typeof realParsePayload
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parsePayload: realParsePayload } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("parsePayload", () => {
    let parsePayload: Subject["parsePayload"]

    beforeAll(async () => {
        ;({ parsePayload } = await build())
    })

    it("reads a JSON object as the payload", () => {
        expect(parsePayload('{"q":"an","size":3}')).toEqual({ ok: true, value: { q: "an", size: 3 } })
    })

    it("reads an empty object, which is what a read without variables sends", () => {
        expect(parsePayload("{}")).toEqual({ ok: true, value: {} })
    })

    it.each([
        ["an array", "[1,2]"],
        ["a string", '"an"'],
        ["a number", "7"],
        ["null", "null"],
        ["text that is not JSON", "{q:"],
        ["an empty text", ""],
    ])("refuses %s", (_label, text) => {
        expect(parsePayload(text)).toEqual({ ok: false })
    })

    it("refuses a text longer than the bound before it parses it", () => {
        const long = `{"q":"${"a".repeat(PAYLOAD_MAX)}"}`

        expect(parsePayload(long)).toEqual({ ok: false })
    })

    it("accepts a text exactly at the bound", () => {
        const filler = "a".repeat(PAYLOAD_MAX - '{"q":""}'.length)
        const text = `{"q":"${filler}"}`

        expect(text).toHaveLength(PAYLOAD_MAX)
        expect(parsePayload(text)).toEqual({ ok: true, value: { q: filler } })
    })
})
