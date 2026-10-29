import type * as SubjectModule from "./sepay-connection.policy"
import { Test } from "@nestjs/testing"
import { maskApiKey, readSepayDelivery } from "./sepay-connection.policy"

const SUBJECT = Symbol("sepay-connection.policy")
type Subject = Pick<typeof SubjectModule, "maskApiKey" | "readSepayDelivery">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { maskApiKey, readSepayDelivery } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const body = (value: unknown): Buffer => Buffer.from(JSON.stringify(value))
const BULLETS = "•".repeat(12)

describe("maskApiKey", () => {
    it("shows bullets and the last four characters", async () => {
        const { maskApiKey } = await buildSubject()
        expect(maskApiKey("nivo_abcdef123456")).toBe(`${BULLETS}3456`)
    })

    it.each(["", "abc", "abcd"])("shows bullets only for the short key %j", async (key) => {
        const { maskApiKey } = await buildSubject()
        expect(maskApiKey(key)).toBe(BULLETS)
    })
})

describe("readSepayDelivery", () => {
    it("reads money in as a credit with its amount and transaction id", async () => {
        const { readSepayDelivery } = await buildSubject()
        expect(readSepayDelivery(body({ id: 92704, transferType: "in", transferAmount: 2000 }))).toEqual({
            kind: "credit",
            amountVnd: 2000,
            providerEventId: "92704",
        })
    })

    it("reads money out as a debit and accepts an amount sent as text", async () => {
        const { readSepayDelivery } = await buildSubject()
        expect(readSepayDelivery(body({ id: "x1", transferType: "out", transferAmount: "150000" }))).toEqual({
            kind: "debit",
            amountVnd: 150000,
            providerEventId: "x1",
        })
    })

    it.each([
        ["an unknown transfer type", { id: 1, transferType: "refund", transferAmount: 5 }],
        ["a zero amount", { id: 1, transferType: "in", transferAmount: 0 }],
        ["no amount", { id: 1, transferType: "in" }],
        ["an empty object", {}],
        ["an amount sent as blank text", { id: 1, transferType: "in", transferAmount: "  " }],
        ["an amount sent as words", { id: 1, transferType: "in", transferAmount: "lots" }],
    ])("reads %s as a ping that carries nothing", async (_label, value) => {
        const { readSepayDelivery } = await buildSubject()
        expect(readSepayDelivery(body(value))).toEqual({ kind: "ping", amountVnd: null, providerEventId: null })
    })

    it.each([
        ["a blank text id", { id: "  ", transferType: "in", transferAmount: 10 }],
        ["a missing id", { transferType: "in", transferAmount: 10 }],
        ["an unsafe integer id", { id: 2 ** 60, transferType: "in", transferAmount: 10 }],
    ])("reads money in with %s as a credit with no transaction id", async (_label, value) => {
        const { readSepayDelivery } = await buildSubject()
        expect(readSepayDelivery(body(value))).toEqual({ kind: "credit", amountVnd: 10, providerEventId: null })
    })

    it.each([undefined, Buffer.from("not json"), Buffer.from("[1,2]")])("reads %p as a ping", async (raw) => {
        const { readSepayDelivery } = await buildSubject()
        expect(readSepayDelivery(raw)).toEqual({ kind: "ping", amountVnd: null, providerEventId: null })
    })
})
