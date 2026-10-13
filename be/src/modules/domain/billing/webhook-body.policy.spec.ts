import { BillingErrorCode } from "./errors/billing.error"
import { isJsonObject, numberOf, parseJsonObject, textOf, textOrNull } from "./webhook-body.policy"

describe("webhook body policy", () => {
    describe("parseJsonObject", () => {
        it("parses the raw bytes of a JSON object", () => {
            expect(parseJsonObject(Buffer.from('{"id":7,"nested":{"a":1}}'))).toEqual({ id: 7, nested: { a: 1 } })
        })

        it.each([
            ["missing bytes", undefined],
            ["empty bytes", Buffer.from("")],
            ["broken JSON", Buffer.from("{")],
            ["a JSON array", Buffer.from("[1]")],
            ["a JSON number", Buffer.from("5")],
            ["JSON null", Buffer.from("null")],
        ])("refuses %s", (_name, raw) => {
            expect(() => parseJsonObject(raw)).toThrow(
                expect.objectContaining({ code: BillingErrorCode.WebhookInvalid }),
            )
        })
    })

    describe("isJsonObject", () => {
        it("accepts an object and refuses null, arrays and primitives", () => {
            expect(isJsonObject({})).toBe(true)
            expect(isJsonObject(null)).toBe(false)
            expect(isJsonObject([])).toBe(false)
            expect(isJsonObject("a")).toBe(false)
        })
    })

    describe("value readers", () => {
        it("reads text only from a string", () => {
            expect(textOf("a")).toBe("a")
            expect(textOf(1)).toBeUndefined()
            expect(textOrNull("a")).toBe("a")
            expect(textOrNull(undefined)).toBeNull()
        })

        it("reads a finite number from a number or numeric text only", () => {
            expect(numberOf(5)).toBe(5)
            expect(numberOf("12.5")).toBe(12.5)
            expect(numberOf("abc")).toBeUndefined()
            expect(numberOf(Number.POSITIVE_INFINITY)).toBeUndefined()
            expect(numberOf(null)).toBeUndefined()
            expect(numberOf({})).toBeUndefined()
        })
    })
})
