import { numberField, readJsonObject, textField } from "./inbound-body.policy"

describe("inbound-body policy", () => {
    describe("readJsonObject", () => {
        it("reads the JSON object of the delivered bytes", () => {
            expect(readJsonObject(Buffer.from('{"a":1}'))).toEqual({ kind: "ok", value: { a: 1 } })
        })

        it("refuses missing bytes, text that is not JSON and JSON that is not an object", () => {
            expect(readJsonObject()).toMatchObject({ kind: "refused" })
            expect(readJsonObject(Buffer.from("not json"))).toMatchObject({ kind: "refused", params: { reason: expect.stringContaining("SyntaxError") } })
            expect(readJsonObject(Buffer.from("[1]"))).toMatchObject({ kind: "refused" })
            expect(readJsonObject(Buffer.from("null"))).toMatchObject({ kind: "refused" })
            expect(readJsonObject(Buffer.from('"text"'))).toMatchObject({ kind: "refused" })
        })
    })

    describe("textField", () => {
        it("answers a string and an empty text for anything else", () => {
            expect(textField({ a: "x" }, "a")).toBe("x")
            expect(textField({ a: 1 }, "a")).toBe("")
            expect(textField({}, "a")).toBe("")
            expect(textField(null, "a")).toBe("")
            expect(textField("text", "a")).toBe("")
        })
    })

    describe("numberField", () => {
        it("answers a finite number and NaN for anything else", () => {
            expect(numberField({ a: 3 }, "a")).toBe(3)
            expect(numberField({ a: Number.NaN }, "a")).toBeNaN()
            expect(numberField({ a: "3" }, "a")).toBeNaN()
            expect(numberField(undefined, "a")).toBeNaN()
        })
    })
})
