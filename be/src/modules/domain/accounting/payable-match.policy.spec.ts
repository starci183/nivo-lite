import { Test } from "@nestjs/testing"
import type { GatewayPayable } from "./accounting-desk.contracts"
import type { PaymentCredit } from "./accounting-gateway.port"
import { matchPayables } from "./payable-match.policy"

const SUBJECT = Symbol("payable-match.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { matchPayables } }],
    }).compile()
    return moduleRef.get<typeof import("./payable-match.policy")>(SUBJECT)
}

const payable = (invoiceNo: string, amountVnd: number): GatewayPayable => ({
    supplier: "Linh An",
    sellerTaxCode: "0100109106",
    invoiceNo,
    amountVnd,
    issuedOn: "2026-10-01",
})

const debit = (creditRef: string, reference: string, amountVnd: number): PaymentCredit => ({
    creditRef,
    reference,
    amountVnd,
    occurredAt: "2026-10-10T03:00:00Z",
    matched: false,
})

describe("payable-match.policy", () => {
    it("pays an invoice with a debit of its exact amount whose memo names its number, ignoring zeros and punctuation", async () => {
        const policy = await build()

        const matches = policy.matchPayables(
            [payable("0000017", 4_620_000)],
            [debit("d-1", "TT HD-17 Linh An", 4_620_000)],
        )

        expect(matches).toEqual({ paid: [payable("0000017", 4_620_000)], open: [], unclear: [] })
    })

    it("lets one debit pay one invoice only and keeps the second invoice open", async () => {
        const policy = await build()
        const first = payable("17", 1_000_000)
        const second = payable("17", 1_000_000)

        const matches = policy.matchPayables([first, second], [debit("d-1", "HD 17", 1_000_000)])

        expect(matches.paid).toEqual([first])
        expect(matches.open).toEqual([second])
        expect(matches.unclear).toEqual([])
    })

    it("raises a debit with only the amount or only the number as unclear and keeps the invoice open", async () => {
        const policy = await build()
        const byAmount = payable("21", 2_000_000)
        const byNumber = payable("22", 3_000_000)
        const none = payable("23", 9_000_000)

        const matches = policy.matchPayables(
            [byAmount, byNumber, none],
            [debit("d-1", "chuyen tien", 2_000_000), debit("d-2", "HD 22 dot 1", 1_500_000)],
        )

        expect(matches.paid).toEqual([])
        expect(matches.open).toEqual([byAmount, byNumber, none])
        expect(matches.unclear).toEqual([
            { payable: byAmount, debit: debit("d-1", "chuyen tien", 2_000_000) },
            { payable: byNumber, debit: debit("d-2", "HD 22 dot 1", 1_500_000) },
        ])
    })

    it("never matches an invoice without a number by its memo", async () => {
        const policy = await build()

        expect(policy.matchPayables([payable("000", 5)], [debit("d-1", "000", 6)]).unclear).toEqual([])
    })
})
