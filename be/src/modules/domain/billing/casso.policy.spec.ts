import { Test } from "@nestjs/testing"

import { createHmac } from "node:crypto"

import {
    cassoCredits as realCassoCredits,
    cassoSignature as realCassoSignature,
    isCassoAuthentic as realIsCassoAuthentic,
    isCassoError as realIsCassoError,
} from "./casso.policy"

const SUBJECT = Symbol("casso.policy")

const KEY = "casso-key"

const BODY = { error: 0, data: { b: 1, a: { d: 2, c: 3 } } }

const signedBy = (key: string, timestamp: string): string =>
    createHmac("sha512", key).update(`${timestamp}.{"data":{"a":{"c":3,"d":2},"b":1},"error":0}`).digest("hex")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    cassoCredits: realCassoCredits,
                    cassoSignature: realCassoSignature,
                    isCassoAuthentic: realIsCassoAuthentic,
                    isCassoError: realIsCassoError,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<{
        cassoCredits: typeof realCassoCredits
        cassoSignature: typeof realCassoSignature
        isCassoAuthentic: typeof realIsCassoAuthentic
        isCassoError: typeof realIsCassoError
    }>(SUBJECT)
    const cassoCredits = subject.cassoCredits
    const cassoSignature = subject.cassoSignature
    const isCassoAuthentic = subject.isCassoAuthentic
    const isCassoError = subject.isCassoError

    return { cassoCredits, cassoSignature, isCassoAuthentic, isCassoError }
}

describe("casso policy > cassoSignature", () => {
    it("signs the timestamp and the body with its keys sorted at every level", async () => {
        const { cassoSignature } = await buildSubject()

        expect(cassoSignature(BODY, "1700", KEY)).toBe(signedBy(KEY, "1700"))
    })

    it("keeps a null value and a primitive as they are", async () => {
        const { cassoSignature } = await buildSubject()

        expect(cassoSignature({ x: null, y: "s" }, "1", KEY)).toBe(
            createHmac("sha512", KEY).update('1.{"x":null,"y":"s"}').digest("hex"),
        )
    })
})

describe("casso policy > isCassoAuthentic", () => {
    it("accepts a V2 signature of the sorted body made with the key", async () => {
        const { isCassoAuthentic } = await buildSubject()

        const signature = `t=1700,v1=${signedBy(KEY, "1700")}`
        expect(isCassoAuthentic({ body: BODY, signature, secureToken: undefined, key: KEY })).toBe(true)
    })

    it("accepts the hex of the signature in upper case", async () => {
        const { isCassoAuthentic } = await buildSubject()

        const signature = `t=1700, v1=${signedBy(KEY, "1700").toUpperCase()}`
        expect(isCassoAuthentic({ body: BODY, signature, secureToken: undefined, key: KEY })).toBe(true)
    })

    it("refuses a signature made with another key or over another timestamp or body", async () => {
        const { isCassoAuthentic } = await buildSubject()

        const other = `t=1700,v1=${signedBy("other-key", "1700")}`
        const later = `t=1701,v1=${signedBy(KEY, "1700")}`
        expect(isCassoAuthentic({ body: BODY, signature: other, secureToken: undefined, key: KEY })).toBe(false)
        expect(isCassoAuthentic({ body: BODY, signature: later, secureToken: undefined, key: KEY })).toBe(false)
        const tampered = { error: 0, data: { b: 2, a: { d: 2, c: 3 } } }
        const valid = `t=1700,v1=${signedBy(KEY, "1700")}`
        expect(isCassoAuthentic({ body: tampered, signature: valid, secureToken: undefined, key: KEY })).toBe(false)
    })

    it("does not fall back to the legacy token when a V2 signature header is present", async () => {
        const { isCassoAuthentic } = await buildSubject()

        const wrong = `t=1700,v1=${signedBy("other-key", "1700")}`
        expect(isCassoAuthentic({ body: BODY, signature: wrong, secureToken: KEY, key: KEY })).toBe(false)
    })

    it("accepts the legacy secure token equal to the key when there is no signature header", async () => {
        const { isCassoAuthentic } = await buildSubject()

        expect(isCassoAuthentic({ body: BODY, signature: undefined, secureToken: KEY, key: KEY })).toBe(true)
        expect(isCassoAuthentic({ body: BODY, signature: "garbage", secureToken: KEY, key: KEY })).toBe(true)
    })

    it("refuses a legacy token that differs, is empty or is missing", async () => {
        const { isCassoAuthentic } = await buildSubject()

        expect(isCassoAuthentic({ body: BODY, signature: undefined, secureToken: "nope", key: KEY })).toBe(false)
        expect(isCassoAuthentic({ body: BODY, signature: undefined, secureToken: "", key: KEY })).toBe(false)
        expect(isCassoAuthentic({ body: BODY, signature: undefined, secureToken: undefined, key: KEY })).toBe(false)
    })

    it("proves nothing with an empty key, even for a token that is empty too", async () => {
        const { isCassoAuthentic } = await buildSubject()

        expect(isCassoAuthentic({ body: BODY, signature: undefined, secureToken: "", key: "" })).toBe(false)
    })
})

describe("casso policy > isCassoError", () => {
    it("flags a non-zero error code and passes a missing or zero one", async () => {
        const { isCassoError } = await buildSubject()

        expect(isCassoError({ error: 2 })).toBe(true)
        expect(isCassoError({ error: "1" })).toBe(true)
        expect(isCassoError({ error: 0 })).toBe(false)
        expect(isCassoError({})).toBe(false)
    })
})

describe("casso policy > cassoCredits", () => {
    it("reads one V2 object and a V1 array of transactions", async () => {
        const { cassoCredits } = await buildSubject()

        const tx = { id: 7, description: " NIVO8F3K2 ", amount: "150000", bankName: "ACB" }
        const expected = { amount: 150000, content: "NIVO8F3K2", eventId: "casso:7", bankName: "ACB" }
        expect(cassoCredits({ data: tx })).toEqual([expected])
        expect(cassoCredits({ data: [tx] })).toEqual([expected])
    })

    it("falls back to the tid or the reference as the id and to Casso as the bank", async () => {
        const { cassoCredits } = await buildSubject()

        expect(
            cassoCredits({
                data: [
                    { tid: "T1", amount: 5 },
                    { reference: "R1", amount: 6 },
                ],
            }),
        ).toEqual([
            { amount: 5, content: "", eventId: "casso:T1", bankName: "Casso" },
            { amount: 6, content: "", eventId: "casso:R1", bankName: "Casso" },
        ])
    })

    it("skips debits, zero amounts, unreadable amounts, missing ids and rows that are not objects", async () => {
        const { cassoCredits } = await buildSubject()

        const rows = [
            { id: 1, amount: -5 },
            { id: 2, amount: 0 },
            { id: 3 },
            { id: 4, amount: "abc" },
            { amount: 10 },
            { id: "", amount: 10 },
            "text",
            null,
        ]
        expect(cassoCredits({ data: rows })).toEqual([])
        expect(cassoCredits({})).toEqual([])
    })
})
