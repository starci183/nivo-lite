import { Test } from "@nestjs/testing"

import { BillingErrorCode } from "./errors/billing.error"

import {
    isValidApiKey as realIsValidApiKey,
    presentedApiKey as realPresentedApiKey,
    qrImageUrl as realQrImageUrl,
    sepayPayloadOf as realSepayPayloadOf,
} from "./sepay.policy"

const SUBJECT = Symbol("sepay.policy")

type Subject = {
    isValidApiKey: typeof realIsValidApiKey
    presentedApiKey: typeof realPresentedApiKey
    qrImageUrl: typeof realQrImageUrl
    sepayPayloadOf: typeof realSepayPayloadOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isValidApiKey: realIsValidApiKey,
                    presentedApiKey: realPresentedApiKey,
                    qrImageUrl: realQrImageUrl,
                    sepayPayloadOf: realSepayPayloadOf,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)

    return { subject }
}

describe("sepay policy > presentedApiKey", () => {
    it("reads the key of an Apikey header and nothing else", async () => {
        const { subject } = await buildSubject()

        expect(subject.presentedApiKey("Apikey  abc ")).toBe("abc")
        expect(subject.presentedApiKey("Bearer abc")).toBeUndefined()
        expect(subject.presentedApiKey(undefined)).toBeUndefined()
    })
})

describe("sepay policy > isValidApiKey", () => {
    it("accepts exactly the configured key", async () => {
        const { subject } = await buildSubject()

        expect(subject.isValidApiKey("Apikey s3cret", "s3cret")).toBe(true)
        expect(subject.isValidApiKey("  apikey   s3cret  ", "s3cret")).toBe(true)
    })

    it("refuses another key, a key of another length, another scheme and a missing header", async () => {
        const { subject } = await buildSubject()

        expect(subject.isValidApiKey("Apikey s3creT", "s3cret")).toBe(false)
        expect(subject.isValidApiKey("Apikey s3cret2", "s3cret")).toBe(false)
        expect(subject.isValidApiKey("Bearer s3cret", "s3cret")).toBe(false)
        expect(subject.isValidApiKey(undefined, "s3cret")).toBe(false)
    })

    it("refuses every delivery when no key is configured", async () => {
        const { subject } = await buildSubject()

        expect(subject.isValidApiKey("Apikey ", undefined)).toBe(false)
        expect(subject.isValidApiKey("Apikey anything", "")).toBe(false)
    })
})

describe("sepay policy > qrImageUrl", () => {
    it("builds the VietQR image url of the account, amount and order code", async () => {
        const { subject } = await buildSubject()

        expect(subject.qrImageUrl({ account: "0123", bank: "MB", holder: "NIVO" }, 990000, "NIVO8F3K2")).toBe(
            "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=990000&des=NIVO8F3K2&template=compact",
        )
    })
})

describe("sepay policy > sepayPayloadOf", () => {
    it("reads the fields the settlement uses", async () => {
        const { subject } = await buildSubject()

        const body = {
            id: 42,
            transferType: "in",
            transferAmount: "990000",
            content: "NIVO8F3K2",
            code: null,
            description: "BankAPINotify",
            gateway: "MB",
        }
        expect(subject.sepayPayloadOf(body)).toEqual({
            id: 42,
            gateway: "MB",
            transferType: "in",
            transferAmount: 990000,
            content: "NIVO8F3K2",
            code: null,
            description: "BankAPINotify",
        })
    })

    it("leaves missing or mistyped fields empty and counts a missing amount as 0", async () => {
        const { subject } = await buildSubject()

        expect(subject.sepayPayloadOf({ id: "7", transferType: 1, content: 5 })).toEqual({
            id: 7,
            gateway: undefined,
            transferType: undefined,
            transferAmount: 0,
            content: null,
            code: null,
            description: null,
        })
    })

    it("keeps an unreadable amount undefined so nothing is settled with it", async () => {
        const { subject } = await buildSubject()

        expect(subject.sepayPayloadOf({ id: 1, transferAmount: "x" })).toMatchObject({ transferAmount: undefined })
        expect(subject.sepayPayloadOf({ id: 1, transferAmount: null })).toMatchObject({ transferAmount: 0 })
    })

    it.each([[undefined], [null], ["abc"], [1.5], [Number.MAX_SAFE_INTEGER + 2]])("refuses the id %p", async (id) => {
        const { subject } = await buildSubject()

        expect(() => subject.sepayPayloadOf({ id })).toThrow(
            expect.objectContaining({ code: BillingErrorCode.WebhookInvalid }),
        )
    })
})
