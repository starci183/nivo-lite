import type { SepayTransaction } from "@modules/integrations/sepay"
import { sepayPolledCredit } from "./sepay-poll.policy"

/** The transfer the owner made on 2026-11-04 01:06: SePay transaction 95958515, +5000 into account 525209999. */
const REAL: SepayTransaction = {
    id: "95958515",
    occurredAt: new Date("2026-11-03T18:06:00.000Z"),
    amountIn: 5000,
    amountOut: 0,
    content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    code: null,
    bank: "MBBank",
}

describe("sepayPolledCredit", () => {
    it("maps a real transfer to the credit and the delivery key the webhook uses for the same transaction", () => {
        expect(sepayPolledCredit("conn-1", REAL)).toEqual({
            deliveryId: "conn-1:sepay:95958515",
            credit: {
                amount: 5000,
                content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
                eventId: "sepay:95958515",
                fallbackBankName: "MBBank",
            },
        })
    })

    it("maps money out to a debit", () => {
        expect(sepayPolledCredit("conn-1", { ...REAL, amountIn: 0, amountOut: 120 })?.credit).toMatchObject({
            amount: 120,
            direction: "debit",
        })
    })

    it("falls back to the code for the content and to SePay for the bank", () => {
        expect(sepayPolledCredit("conn-1", { ...REAL, content: "", code: "DH7", bank: null })?.credit).toMatchObject({
            content: "DH7",
            fallbackBankName: "SePay",
        })
        expect(sepayPolledCredit("conn-1", { ...REAL, content: "", code: null })?.credit.content).toBe("")
    })

    it("maps a row that moved no money to nothing", () => {
        expect(sepayPolledCredit("conn-1", { ...REAL, amountIn: 0 })).toBeUndefined()
    })
})
