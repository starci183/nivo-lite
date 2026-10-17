import { Test } from "@nestjs/testing"

import { BillingErrorCode } from "./errors/billing.error"

import {
    isJsonObject as realIsJsonObject,
    numberOf as realNumberOf,
    parseJsonObject as realParseJsonObject,
    textOf as realTextOf,
    textOrNull as realTextOrNull,
} from "./webhook-body.policy"

const SUBJECT = Symbol("webhook-body.policy")

type Subject = {
    isJsonObject: typeof realIsJsonObject
    numberOf: typeof realNumberOf
    parseJsonObject: typeof realParseJsonObject
    textOf: typeof realTextOf
    textOrNull: typeof realTextOrNull
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isJsonObject: realIsJsonObject,
                    numberOf: realNumberOf,
                    parseJsonObject: realParseJsonObject,
                    textOf: realTextOf,
                    textOrNull: realTextOrNull,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)

    return { subject }
}

describe("webhook body policy", () => {
    describe("parseJsonObject", () => {
        it("parses the raw bytes of a JSON object", async () => {
            const { subject } = await buildSubject()

            expect(subject.parseJsonObject(Buffer.from('{"id":7,"nested":{"a":1}}'))).toEqual({
                id: 7,
                nested: { a: 1 },
            })
        })

        it.each([
            ["missing bytes", undefined],
            ["empty bytes", Buffer.from("")],
            ["broken JSON", Buffer.from("{")],
            ["a JSON array", Buffer.from("[1]")],
            ["a JSON number", Buffer.from("5")],
            ["JSON null", Buffer.from("null")],
        ])("refuses %s", async (_name, raw) => {
            const { subject } = await buildSubject()

            expect(() => subject.parseJsonObject(raw)).toThrow(
                expect.objectContaining({ code: BillingErrorCode.WebhookInvalid }),
            )
        })
    })

    describe("isJsonObject", () => {
        it("accepts an object and refuses null, arrays and primitives", async () => {
            const { subject } = await buildSubject()

            expect(subject.isJsonObject({})).toBe(true)
            expect(subject.isJsonObject(null)).toBe(false)
            expect(subject.isJsonObject([])).toBe(false)
            expect(subject.isJsonObject("a")).toBe(false)
        })
    })

    describe("value readers", () => {
        it("reads text only from a string", async () => {
            const { subject } = await buildSubject()

            expect(subject.textOf("a")).toBe("a")
            expect(subject.textOf(1)).toBeUndefined()
            expect(subject.textOrNull("a")).toBe("a")
            expect(subject.textOrNull(undefined)).toBeNull()
        })

        it("reads a finite number from a number or numeric text only", async () => {
            const { subject } = await buildSubject()

            expect(subject.numberOf(5)).toBe(5)
            expect(subject.numberOf("12.5")).toBe(12.5)
            expect(subject.numberOf("abc")).toBeUndefined()
            expect(subject.numberOf(Number.POSITIVE_INFINITY)).toBeUndefined()
            expect(subject.numberOf(null)).toBeUndefined()
            expect(subject.numberOf({})).toBeUndefined()
        })
    })
})
