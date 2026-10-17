import { Test } from "@nestjs/testing"

import { payloadOf as payloadOfImplementation, stampOf as stampOfImplementation } from "./sepay-payload.policy"

const SUBJECT = Symbol("subject")

type Subject = {
    payloadOf: typeof payloadOfImplementation
    stampOf: typeof stampOfImplementation
}

const NOW = new Date("2026-10-12T18:20:30.456Z")

const ACCOUNT = { bankCode: "MBBank", bankAccount: "0123456789" }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { payloadOf: payloadOfImplementation, stampOf: stampOfImplementation } },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)

    return { subject }
}

describe("SePay payload policy", () => {
    it("prints Vietnam time across midnight without milliseconds", async () => {
        const { subject } = await buildSubject()

        expect(subject.stampOf(NOW)).toBe("2026-10-13 01:20:30")
        expect(subject.stampOf(new Date("2026-12-31T17:00:00.000Z"))).toBe("2027-01-01 00:00:00")
    })

    it("prints the complete credit payload with the clock as the transaction id", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.payloadOf(
                { orderCode: "NIVO8F3K2", amount: 299000, transactionId: undefined, debit: false },
                ACCOUNT,
                NOW,
            ),
        ).toEqual({
            id: 1791829230456,
            gateway: "MBBank",
            transactionDate: "2026-10-13 01:20:30",
            accountNumber: "0123456789",
            subAccount: null,
            code: null,
            content: "NIVO8F3K2 chuyen tien",
            transferType: "in",
            description: "BankAPINotify NIVO8F3K2 chuyen tien",
            transferAmount: 299000,
            referenceCode: "FT1791829230456",
            accumulated: 0,
        })
    })

    it("preserves an explicit zero id and prints a debit", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.payloadOf({ orderCode: "NIVO23456", amount: 150000, transactionId: 0, debit: true }, ACCOUNT, NOW),
        ).toEqual({
            id: 0,
            gateway: "MBBank",
            transactionDate: "2026-10-13 01:20:30",
            accountNumber: "0123456789",
            subAccount: null,
            code: null,
            content: "NIVO23456 chuyen tien",
            transferType: "out",
            description: "BankAPINotify NIVO23456 chuyen tien",
            transferAmount: 150000,
            referenceCode: "FT1791829230456",
            accumulated: 0,
        })
    })
})
