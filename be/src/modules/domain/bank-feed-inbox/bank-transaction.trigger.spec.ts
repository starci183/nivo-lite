import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    BANK_TRANSACTION_TRIGGERS as realTriggers,
    bankTransactionTriggerFor as realTriggerFor,
    type BankTransactionRow,
} from "./bank-transaction.trigger"
import { feedTransactionRowsOf } from "./bank-feed.normalise.policy"

const SUBJECT = Symbol("bank-transaction.trigger")
type Subject = { triggers: typeof realTriggers; triggerFor: typeof realTriggerFor }

const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { triggers: realTriggers, triggerFor: realTriggerFor } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const ORIGIN = { connectionId: "conn-1" }

/** The row the feed's intake writes of one credit, made by the intake's own normaliser. */
const rowOf = (patch: Record<string, unknown> = {}): BankTransactionRow => {
    const [row] = feedTransactionRowsOf("sepay-feed", {
        connection: "conn-1",
        credits: [
            {
                amount: 150_000.4,
                content: "DH123 thanh toan",
                eventId: "tx-1",
                fallbackBankName: "VCB",
                account: "0123",
                bankRef: "FT1",
                occurredAt: "2026-11-14T01:00:00.000Z",
                ...patch,
            },
        ],
    })
    return row?.value as unknown as BankTransactionRow
}

describe("the bank feeds' transaction trigger", () => {
    it("is declared once per bank feed, for the credit verb, received by webhook, keyed by the transaction", async () => {
        const { triggers, triggerFor } = await buildSubject()

        expect(triggers.map((one) => [one.provider, one.name, one.verb, one.via])).toEqual([
            [PROVIDER.sepay, "transaction.received", TRIGGER.paymentCreditReceived, "webhook"],
            [PROVIDER.casso, "transaction.received", TRIGGER.paymentCreditReceived, "webhook"],
            [PROVIDER.payos, "transaction.received", TRIGGER.paymentCreditReceived, "webhook"],
        ])
        expect(triggerFor(PROVIDER.sepay)?.key).toEqual({ by: "data", member: "transactionId" })
        expect(triggerFor("imap")).toBeNull()
        expect(triggerFor(PROVIDER.sepay)?.settle).toBeNull()
    })

    it("translates the stored row of a credit into one event: the provider's id, money in, the facts of the row", async () => {
        const { triggerFor } = await buildSubject()
        const sepay = triggerFor(PROVIDER.sepay)

        expect(sepay?.translate(rowOf(), ORIGIN)).toEqual({
            id: "tx-1",
            data: {
                transactionId: "tx-1",
                direction: "in",
                amountVnd: 150_000,
                content: "DH123 thanh toan",
                at: "2026-11-14T01:00:00.000Z",
                account: "0123",
                bankRef: "FT1",
            },
        })
    })

    it("is pure (same row, same event, no subject: a movement names no person) and fits its schemas", async () => {
        const { triggerFor } = await buildSubject()
        const sepay = triggerFor(PROVIDER.sepay)
        const row = rowOf()

        const first = sepay?.translate(row, ORIGIN)
        expect(sepay?.translate(row, ORIGIN)).toEqual(first)
        expect(first?.subject).toBeUndefined()
        expect(sepay?.raw.safeParse(row).success).toBe(true)
        expect(sepay?.data.safeParse(first?.data).success).toBe(true)
    })

    it("keeps money out as `out` (the credit registrations narrow to `in`) and leaves out a fact the row lacks", async () => {
        const { triggerFor } = await buildSubject()

        const debit = triggerFor(PROVIDER.casso)?.translate(rowOf({ direction: "debit", account: undefined, bankRef: undefined, occurredAt: undefined }), ORIGIN)
        expect(debit?.data).toEqual({ transactionId: "tx-1", direction: "out", amountVnd: 150_000, content: "DH123 thanh toan" })
    })
})
