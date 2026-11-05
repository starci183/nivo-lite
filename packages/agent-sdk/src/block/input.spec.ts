import { z } from "zod"
import { actionPayloadOf, parseStrict } from "./input"

const SCHEMA = z.object({ id: z.string().max(20), page: z.number().optional() })

describe("parseStrict", () => {
    it("returns the typed value of a sound raw value", () => {
        expect(parseStrict(SCHEMA, { id: "a", page: 2 })).toEqual({ ok: true, value: { id: "a", page: 2 } })
    })

    it("refuses a key the schema does not declare, naming it", () => {
        expect(parseStrict(SCHEMA, { id: "a", extra: 1 })).toEqual({
            ok: false,
            problems: [{ code: "INPUT_UNKNOWN_KEY", at: "extra" }],
        })
    })

    it("names the path of every value the schema refuses", () => {
        expect(parseStrict(SCHEMA, { id: 3, page: "x" })).toEqual({
            ok: false,
            problems: [
                { code: "INPUT_INVALID", at: "id" },
                { code: "INPUT_INVALID", at: "page" },
            ],
        })
    })

    it("lists unknown keys before the refused values", () => {
        expect(parseStrict(SCHEMA, { id: 3, extra: 1 }).ok).toBe(false)
        expect(parseStrict(SCHEMA, { id: 3, extra: 1 })).toEqual({
            ok: false,
            problems: [
                { code: "INPUT_UNKNOWN_KEY", at: "extra" },
                { code: "INPUT_INVALID", at: "id" },
            ],
        })
    })

    it("refuses a raw value that is not an object as a whole", () => {
        expect(parseStrict(SCHEMA, "nope")).toEqual({ ok: false, problems: [{ code: "INPUT_INVALID", at: "." }] })
        expect(parseStrict(SCHEMA, null)).toEqual({ ok: false, problems: [{ code: "INPUT_INVALID", at: "." }] })
    })
})

describe("actionPayloadOf", () => {
    it("merges the id into the values and keeps the command when given", () => {
        expect(actionPayloadOf({ id: "r1", command: "move", values: { stage: "won" } })).toEqual({
            id: "r1",
            command: "move",
            stage: "won",
        })
    })

    it("is the id alone for an input without values or command", () => {
        expect(actionPayloadOf({ id: "r1" })).toEqual({ id: "r1" })
    })

    it("lets the id of the input win over an id among the values", () => {
        expect(actionPayloadOf({ id: "r1", values: { id: "other" } })).toEqual({ id: "r1" })
    })
})
