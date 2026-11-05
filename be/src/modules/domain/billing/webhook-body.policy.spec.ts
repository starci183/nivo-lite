import { Test } from "@nestjs/testing"

import { BillingErrorCode } from "./errors/billing.error"

import {
    isJsonObject as realIsJsonObject,
    fieldNumberOf as realFieldNumberOf,
    parseJsonObject as realParseJsonObject,
    fieldTextOf as realFieldTextOf,
    fieldTextOrNullOf as realFieldTextOrNullOf,
} from "./webhook-body.policy"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("webhook-body.policy")

type Subject = {
    isJsonObject: typeof realIsJsonObject
    fieldNumberOf: typeof realFieldNumberOf
    parseJsonObject: typeof realParseJsonObject
    fieldTextOf: typeof realFieldTextOf
    fieldTextOrNullOf: typeof realFieldTextOrNullOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isJsonObject: realIsJsonObject,
                    fieldNumberOf: realFieldNumberOf,
                    parseJsonObject: realParseJsonObject,
                    fieldTextOf: realFieldTextOf,
                    fieldTextOrNullOf: realFieldTextOrNullOf,
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

            expect(thrownBy(() => subject.parseJsonObject(raw))).toEqual(
                objectLike({ code: BillingErrorCode.WebhookInvalid }),
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

            expect(subject.fieldTextOf("a")).toBe("a")
            expect(subject.fieldTextOf(1)).toBeUndefined()
            expect(subject.fieldTextOrNullOf("a")).toBe("a")
            expect(subject.fieldTextOrNullOf(undefined)).toBeNull()
        })

        it("reads a finite number from a number or numeric text only", async () => {
            const { subject } = await buildSubject()

            expect(subject.fieldNumberOf(5)).toBe(5)
            expect(subject.fieldNumberOf("12.5")).toBe(12.5)
            expect(subject.fieldNumberOf("abc")).toBeUndefined()
            expect(subject.fieldNumberOf(Number.POSITIVE_INFINITY)).toBeUndefined()
            expect(subject.fieldNumberOf(null)).toBeUndefined()
            expect(subject.fieldNumberOf({})).toBeUndefined()
        })
    })
})
