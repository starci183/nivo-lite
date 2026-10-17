import { Test } from "@nestjs/testing"
import { parseJsonText } from "./json-read.policy"
const SUBJECT = Symbol("json-read.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parseJsonText } }],
    }).compile()
    return moduleRef.get<typeof import("./json-read.policy")>(SUBJECT)
}

describe("parseJsonText", () => {
    it("returns the parsed value of valid JSON text", async () => {
        const subject = await build()

        expect(subject.parseJsonText('{"appId":"a","n":1}')).toEqual({ ok: true, value: { appId: "a", n: 1 } })
    })

    it("returns a parsed scalar as it is", async () => {
        const subject = await build()

        expect(subject.parseJsonText("42")).toEqual({ ok: true, value: 42 })
    })

    it("returns the parse error as the cause of malformed text", async () => {
        const subject = await build()

        const read = subject.parseJsonText("{not json")

        expect(read.ok).toBe(false)
        expect(read.ok ? null : read.cause).toBeInstanceOf(SyntaxError)
    })

    it("treats empty text as malformed", async () => {
        const subject = await build()

        expect(subject.parseJsonText("").ok).toBe(false)
    })
})
