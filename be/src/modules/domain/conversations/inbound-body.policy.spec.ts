import { Test } from "@nestjs/testing"
import { numberField, readJsonObject, textField } from "./inbound-body.policy"

const SUBJECT = Symbol("inbound-body.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readJsonObject, textField, numberField } }],
    }).compile()
    return moduleRef.get<typeof import("./inbound-body.policy")>(SUBJECT)
}

describe("inbound-body policy", () => {
    describe("readJsonObject", () => {
        it("reads the JSON object of the delivered bytes", async () => {
            const subject = await buildSubject()

            expect(subject.readJsonObject(Buffer.from('{"a":1}'))).toEqual({ kind: "ok", value: { a: 1 } })
        })

        it("refuses missing bytes, text that is not JSON and JSON that is not an object", async () => {
            const subject = await buildSubject()

            expect(subject.readJsonObject()).toMatchObject({ kind: "refused" })
            expect(subject.readJsonObject(Buffer.from("not json"))).toMatchObject({
                kind: "refused",
                params: { reason: expect.stringContaining("SyntaxError") },
            })
            expect(subject.readJsonObject(Buffer.from("[1]"))).toMatchObject({ kind: "refused" })
            expect(subject.readJsonObject(Buffer.from("null"))).toMatchObject({ kind: "refused" })
            expect(subject.readJsonObject(Buffer.from('"text"'))).toMatchObject({ kind: "refused" })
        })
    })

    describe("textField", () => {
        it("answers a string and an empty text for anything else", async () => {
            const subject = await buildSubject()

            expect(subject.textField({ a: "x" }, "a")).toBe("x")
            expect(subject.textField({ a: 1 }, "a")).toBe("")
            expect(subject.textField({}, "a")).toBe("")
            expect(subject.textField(null, "a")).toBe("")
            expect(subject.textField("text", "a")).toBe("")
        })
    })

    describe("numberField", () => {
        it("answers a finite number and NaN for anything else", async () => {
            const subject = await buildSubject()

            expect(subject.numberField({ a: 3 }, "a")).toBe(3)
            expect(subject.numberField({ a: Number.NaN }, "a")).toBeNaN()
            expect(subject.numberField({ a: "3" }, "a")).toBeNaN()
            expect(subject.numberField(undefined, "a")).toBeNaN()
        })
    })
})
