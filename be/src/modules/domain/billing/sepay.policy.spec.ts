import { BillingErrorCode } from "./errors/billing.error"
import { isValidApiKey, presentedApiKey, qrImageUrl, sepayPayloadOf } from "./sepay.policy"

describe("sepay policy", () => {
    describe("presentedApiKey", () => {
        it("reads the key of an Apikey header and nothing else", () => {
            expect(presentedApiKey("Apikey  abc ")).toBe("abc")
            expect(presentedApiKey("Bearer abc")).toBeUndefined()
            expect(presentedApiKey(undefined)).toBeUndefined()
        })
    })

    describe("isValidApiKey", () => {
        it("accepts exactly the configured key", () => {
            expect(isValidApiKey("Apikey s3cret", "s3cret")).toBe(true)
            expect(isValidApiKey("  apikey   s3cret  ", "s3cret")).toBe(true)
        })

        it("refuses another key, a key of another length, another scheme and a missing header", () => {
            expect(isValidApiKey("Apikey s3creT", "s3cret")).toBe(false)
            expect(isValidApiKey("Apikey s3cret2", "s3cret")).toBe(false)
            expect(isValidApiKey("Bearer s3cret", "s3cret")).toBe(false)
            expect(isValidApiKey(undefined, "s3cret")).toBe(false)
        })

        it("refuses every delivery when no key is configured", () => {
            expect(isValidApiKey("Apikey ", undefined)).toBe(false)
            expect(isValidApiKey("Apikey anything", "")).toBe(false)
        })
    })

    describe("qrImageUrl", () => {
        it("builds the VietQR image url of the account, amount and order code", () => {
            expect(qrImageUrl({ account: "0123", bank: "MB", holder: "NIVO" }, 990000, "NIVO8F3K2")).toBe(
                "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=990000&des=NIVO8F3K2&template=compact",
            )
        })
    })

    describe("sepayPayloadOf", () => {
        it("reads the fields the settlement uses", () => {
            const body = {
                id: 42,
                transferType: "in",
                transferAmount: "990000",
                content: "NIVO8F3K2",
                code: null,
                description: "BankAPINotify",
                gateway: "MB",
            }
            expect(sepayPayloadOf(body)).toEqual({
                id: 42,
                gateway: "MB",
                transferType: "in",
                transferAmount: 990000,
                content: "NIVO8F3K2",
                code: null,
                description: "BankAPINotify",
            })
        })

        it("leaves missing or mistyped fields empty and counts a missing amount as 0", () => {
            expect(sepayPayloadOf({ id: "7", transferType: 1, content: 5 })).toEqual({
                id: 7,
                gateway: undefined,
                transferType: undefined,
                transferAmount: 0,
                content: null,
                code: null,
                description: null,
            })
        })

        it("keeps an unreadable amount undefined so nothing is settled with it", () => {
            expect(sepayPayloadOf({ id: 1, transferAmount: "x" })).toMatchObject({ transferAmount: undefined })
            expect(sepayPayloadOf({ id: 1, transferAmount: null })).toMatchObject({ transferAmount: 0 })
        })

        it.each([[undefined], [null], ["abc"], [1.5], [Number.MAX_SAFE_INTEGER + 2]])("refuses the id %p", (id) => {
            expect(() => sepayPayloadOf({ id })).toThrow(
                expect.objectContaining({ code: BillingErrorCode.WebhookInvalid }),
            )
        })
    })
})
