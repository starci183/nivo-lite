import { readJson } from "./telegram-user-json.policy"

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
    ])("returns the JSON value for %s", (text, value) => {
        expect(readJson(String(text))).toEqual({ ok: true, value })
    })

    it.each(["", "{", "undefined", '{"a":1,}'])("returns the parser cause for invalid JSON (%s)", (text) => {
        expect(readJson(text)).toEqual({ ok: false, cause: parserCause(text) })
    })
})
