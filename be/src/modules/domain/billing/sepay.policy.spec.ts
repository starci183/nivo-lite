import { BillingErrorCode } from "./errors/billing.error"
import { qrImageUrl, sepayPayloadOf } from "./sepay.policy"

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

describe("sepay policy > qrImageUrl", () => {
    it("builds the VietQR image url of the account, amount and order code", () => {
        expect(qrImageUrl({ account: "0123", bank: "MB", holder: "NIVO" }, 990000, "NIVO8F3K2")).toBe(
            "https://qr.sepay.vn/img?acc=0123&bank=MB&amount=990000&des=NIVO8F3K2&template=compact",
        )
    })
})

describe("sepay policy > sepayPayloadOf", () => {
    it("reads a delivery to NIVO's own billing door", () => {
        expect(sepayPayloadOf({ id: 42, transferType: "in", transferAmount: "990000" })).toMatchObject({
            id: 42,
            transferAmount: 990000,
        })
    })

    it("refuses a delivery without a safe integer id as invalid", () => {
        expect(thrownBy(() => sepayPayloadOf({ id: "abc" }))).toEqual(
            objectLike({ code: BillingErrorCode.WebhookInvalid }),
        )
    })
})
