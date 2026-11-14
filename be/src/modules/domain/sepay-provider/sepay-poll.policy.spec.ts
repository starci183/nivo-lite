import { Test } from "@nestjs/testing"
import { sepayBankTransaction, sepayPolledCredit } from "./sepay-poll.policy"
import type { SepayTransaction } from "@modules/integrations/sepay"

const SUBJECT = Symbol("sepay-poll.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sepayBankTransaction, sepayPolledCredit } }],
    }).compile()
    return moduleRef.get<{
        sepayBankTransaction: typeof sepayBankTransaction
        sepayPolledCredit: typeof sepayPolledCredit
    }>(SUBJECT)
}

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
    it("maps a real transfer to the credit and the delivery key the webhook uses for the same transaction", async () => {
        const subject = await build()

        expect(subject.sepayPolledCredit("conn-1", REAL, "0123456789")).toEqual({
            deliveryId: "conn-1:sepay:95958515",
            credit: {
                amount: 5000,
                content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
                eventId: "sepay:95958515",
                fallbackBankName: "MBBank",
                account: "0123456789",
                occurredAt: "2026-11-03T18:06:00.000Z",
            },
        })
    })

    it("keeps the row's bank reference and its own account number, under the unchanged event id", async () => {
        const subject = await build()

        const row = { ...REAL, reference: "FT25308XYZ", account: "525209999" }
        expect(subject.sepayPolledCredit("conn-1", row, "0123456789")).toEqual({
            deliveryId: "conn-1:sepay:95958515",
            credit: {
                amount: 5000,
                content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
                eventId: "sepay:95958515",
                fallbackBankName: "MBBank",
                account: "525209999",
                occurredAt: "2026-11-03T18:06:00.000Z",
                bankRef: "FT25308XYZ",
            },
        })
    })

    it("falls back to the connection's account and adds no reference when the row names neither", async () => {
        const subject = await build()

        const credit = subject.sepayPolledCredit("conn-1", REAL, "0123456789")?.credit
        expect(credit?.account).toBe("0123456789")
        expect(credit).not.toHaveProperty("bankRef")
        expect(credit?.eventId).toBe("sepay:95958515")
    })

    it("maps money out to a debit", async () => {
        const subject = await build()

        expect(
            subject.sepayPolledCredit("conn-1", { ...REAL, amountIn: 0, amountOut: 120 }, "0123456789")?.credit,
        ).toMatchObject({
            amount: 120,
            direction: "debit",
        })
    })

    it("falls back to the code for the content and to SePay for the bank", async () => {
        const subject = await build()

        expect(
            subject.sepayPolledCredit("conn-1", { ...REAL, content: "", code: "DH7", bank: null }, "0123456789")
                ?.credit,
        ).toMatchObject({
            content: "DH7",
            fallbackBankName: "SePay",
        })
        expect(
            subject.sepayPolledCredit("conn-1", { ...REAL, content: "", code: null }, "0123456789")?.credit.content,
        ).toBe("")
    })

    it("maps a row that moved no money to nothing", async () => {
        const subject = await build()

        expect(subject.sepayPolledCredit("conn-1", { ...REAL, amountIn: 0 }, "0123456789")).toBeUndefined()
    })
})

describe("sepayBankTransaction", () => {
    it("maps the real transfer to the bank-feed shape", async () => {
        const subject = await build()

        expect(subject.sepayBankTransaction(REAL)).toEqual({
            id: "sepay:95958515",
            direction: "credit",
            amountVnd: 5000,
            content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
            occurredAt: "2026-11-03T18:06:00.000Z",
            bankName: "MBBank",
        })
    })

    it("maps money out to a debit and falls back to the code and to SePay", async () => {
        const subject = await build()

        expect(
            subject.sepayBankTransaction({
                ...REAL,
                amountIn: 0,
                amountOut: 120,
                content: "",
                code: "DH7",
                bank: null,
            }),
        ).toMatchObject({
            direction: "debit",
            amountVnd: 120,
            content: "DH7",
            bankName: "SePay",
        })
        expect(subject.sepayBankTransaction({ ...REAL, content: "", code: null })?.content).toBe("")
    })

    it("maps a row that moved no money to nothing", async () => {
        const subject = await build()

        expect(subject.sepayBankTransaction({ ...REAL, amountIn: 0 })).toBeUndefined()
    })
})
