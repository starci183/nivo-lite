import type * as SubjectModule from "./telegram-user-json.policy"
import { Test } from "@nestjs/testing"
import { readJson } from "./telegram-user-json.policy"

const SUBJECT = Symbol("telegram-user-json.policy")
type Subject = Pick<typeof SubjectModule, "readJson">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readJson } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const parserCause = (text: string): unknown => {
    try {
        JSON.parse(text)
        return null
    } catch (cause) {
        return cause
    }
}

describe("readJson", () => {
    it.each([
        ["null", null],
        ["true", true],
        ["42", 42],
        ['"value"', "value"],
        ["[1,2]", [1, 2]],
        ['{"chats":[]}', { chats: [] }],
    ])("returns the JSON value for %s", async (text, value) => {
        const subject = await buildSubject()

        expect(subject.readJson(String(text))).toEqual({ ok: true, value })
    })

    it.each(["", "{", "undefined", '{"a":1,}'])("returns the parser cause for invalid JSON (%s)", async (text) => {
        const subject = await buildSubject()

        expect(subject.readJson(text)).toEqual({ ok: false, cause: parserCause(text) })
    })
})
