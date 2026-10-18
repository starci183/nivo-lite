import { Test } from "@nestjs/testing"

import { createHmac } from "node:crypto"

import {
    isPayosAuthentic as realIsPayosAuthentic,
    isPayosSample as realIsPayosSample,
    payosBodyOf as realPayosBodyOf,
    payosSignature as realPayosSignature,
    readPayosDelivery as realReadPayosDelivery,
} from "./payos.policy"

const SUBJECT = Symbol("payos.policy")

const KEY = "checksum-key"

const DATA = {
    orderCode: 99,
    amount: 50000,
    description: "NIVO8F3K2",
    reference: "REF1",
    nothing: null,
    nested: { a: 1 },
}

const SIGNED = createHmac("sha256", KEY)
    .update('amount=50000&description=NIVO8F3K2&nested={"a":1}&nothing=&orderCode=99&reference=REF1')
    .digest("hex")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isPayosAuthentic: realIsPayosAuthentic,
                    isPayosSample: realIsPayosSample,
                    payosBodyOf: realPayosBodyOf,
                    payosSignature: realPayosSignature,
                    readPayosDelivery: realReadPayosDelivery,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        isPayosAuthentic: typeof realIsPayosAuthentic
        isPayosSample: typeof realIsPayosSample
        payosBodyOf: typeof realPayosBodyOf
        payosSignature: typeof realPayosSignature
        readPayosDelivery: typeof realReadPayosDelivery
    }>(SUBJECT)
    const isPayosAuthentic = subject.isPayosAuthentic
    const isPayosSample = subject.isPayosSample
    const payosBodyOf = subject.payosBodyOf
    const payosSignature = subject.payosSignature
    const readPayosDelivery = subject.readPayosDelivery

    return { isPayosAuthentic, isPayosSample, payosBodyOf, payosSignature, readPayosDelivery }
}

describe("payos policy > payosSignature", () => {
    it("signs the data fields sorted by key as key=value joined by &, null as empty text", async () => {
        const { payosSignature } = await buildSubject()

        expect(payosSignature(DATA, KEY)).toBe(SIGNED)
    })

    it("treats an undefined field as empty text", async () => {
        const { payosSignature } = await buildSubject()

        expect(payosSignature({ a: undefined, b: 1 }, KEY)).toBe(
            createHmac("sha256", KEY).update("a=&b=1").digest("hex"),
        )
    })
})

describe("payos policy > isPayosAuthentic", () => {
    it("accepts the signature of the data made with the checksum key", async () => {
        const { isPayosAuthentic } = await buildSubject()

        expect(isPayosAuthentic({ data: DATA, signature: SIGNED }, KEY)).toBe(true)
    })

    it("refuses another key, a changed field, a missing signature, missing data and an empty key", async () => {
        const { isPayosAuthentic } = await buildSubject()

        expect(isPayosAuthentic({ data: DATA, signature: SIGNED }, "other")).toBe(false)
        expect(isPayosAuthentic({ data: { ...DATA, amount: 1 }, signature: SIGNED }, KEY)).toBe(false)
        expect(isPayosAuthentic({ data: DATA }, KEY)).toBe(false)
        expect(isPayosAuthentic({ signature: SIGNED }, KEY)).toBe(false)
        expect(isPayosAuthentic({ data: DATA, signature: SIGNED }, "")).toBe(false)
    })

    it("refuses a signature of another length", async () => {
        const { isPayosAuthentic } = await buildSubject()

        expect(isPayosAuthentic({ data: DATA, signature: SIGNED.slice(1) }, KEY)).toBe(false)
    })
})

describe("payos policy > isPayosSample", () => {
    it("recognises the confirmation ping order and no other", async () => {
        const { isPayosSample } = await buildSubject()

        expect(isPayosSample({ orderCode: 123 })).toBe(true)
        expect(isPayosSample({ orderCode: "123" })).toBe(true)
        expect(isPayosSample({ orderCode: 124 })).toBe(false)
        expect(isPayosSample({})).toBe(false)
    })
})

describe("payos policy > readPayosDelivery", () => {
    it("reads a paid order as a credit keyed by its reference", async () => {
        const { readPayosDelivery } = await buildSubject()

        expect(readPayosDelivery({ code: "00", success: true, data: DATA })).toEqual({
            kind: "credit",
            amount: 50000,
            content: "NIVO8F3K2",
            eventId: "payos:REF1",
        })
    })

    it("keys the credit by the order code when there is no reference", async () => {
        const { readPayosDelivery } = await buildSubject()

        expect(readPayosDelivery({ code: "00", data: { orderCode: 7, amount: 1000 } })).toEqual({
            kind: "credit",
            amount: 1000,
            content: "",
            eventId: "payos:7",
        })
    })

    it("ignores the sample order, an unpaid delivery and a delivery without an amount or reference", async () => {
        const { readPayosDelivery } = await buildSubject()

        expect(readPayosDelivery({ code: "00", data: { orderCode: 123, amount: 5 } })).toEqual({
            kind: "ignored",
            reason: "sample",
        })
        expect(readPayosDelivery({ code: "00", success: false, data: DATA })).toEqual({
            kind: "ignored",
            reason: "not_paid",
        })
        expect(readPayosDelivery({ code: "01", data: DATA })).toEqual({ kind: "ignored", reason: "not_paid" })
        expect(readPayosDelivery({ code: "00", data: { orderCode: 7, amount: 0 } })).toEqual({
            kind: "ignored",
            reason: "no_amount",
        })
        expect(readPayosDelivery({ code: "00", data: { amount: 10 } })).toEqual({
            kind: "ignored",
            reason: "no_amount",
        })
        expect(readPayosDelivery({ code: "00", data: null })).toEqual({ kind: "ignored", reason: "no_amount" })
    })
})

describe("payos policy > payosBodyOf", () => {
    it("keeps the fields of the delivery that have the right type", async () => {
        const { payosBodyOf } = await buildSubject()

        expect(payosBodyOf({ code: "00", success: true, data: { a: 1 }, signature: "s", extra: 1 })).toEqual({
            code: "00",
            success: true,
            data: { a: 1 },
            signature: "s",
        })
    })

    it("counts a field of the wrong type as absent", async () => {
        const { payosBodyOf } = await buildSubject()

        expect(payosBodyOf({ code: 0, success: "yes", data: [1], signature: 5 })).toEqual({
            code: undefined,
            success: undefined,
            data: null,
            signature: undefined,
        })
        expect(payosBodyOf({ data: null })).toMatchObject({ data: null })
    })
})

describe("payos canonical key ordering", () => {
    it("keeps uppercase keys before lowercase keys in the signed bytes", async () => {
        const { payosSignature } = await buildSubject()
        expect(payosSignature({ a: 1, Z: 2, A: 3 }, KEY)).toBe(
            createHmac("sha256", KEY).update("A=3&Z=2&a=1").digest("hex"),
        )
    })
})
