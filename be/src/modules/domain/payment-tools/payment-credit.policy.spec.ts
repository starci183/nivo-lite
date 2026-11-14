import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { declaredPayloadOf } from "@modules/domain/trigger-specs"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { creditOf as creditOfSubject } from "./payment-credit.policy"
import { CREDIT_GET_SCHEMA as CREDIT_GET_SCHEMASubject } from "./payment-credit.schema"

const SUBJECT = Symbol("payment-credit.policy")

describe("payment-credit.policy built the way Nest does", () => {
    let CREDIT_GET_SCHEMA: typeof CREDIT_GET_SCHEMASubject
    let creditOf: typeof creditOfSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ CREDIT_GET_SCHEMA: typeof CREDIT_GET_SCHEMASubject; creditOf: typeof creditOfSubject }>({ CREDIT_GET_SCHEMA: CREDIT_GET_SCHEMASubject, creditOf: creditOfSubject }) }],
        }).compile()
        ;({ CREDIT_GET_SCHEMA, creditOf } = moduleRef.get<{ CREDIT_GET_SCHEMA: typeof CREDIT_GET_SCHEMASubject; creditOf: typeof creditOfSubject }>(SUBJECT))
    })

// The neutral one-credit shape of the raw `<provider>.transaction` row. SePay, Casso and payOS declare ONE row shape (purpose
// `bank.transaction`: `bank-feed.data-types.ts` builds all three from one declaration), so the mapper is one: the very fields the bank
// trigger's fill reads (`TriggerSpec.reads` of `payment.credit.received`), plus the direction.

const AT = "2026-11-13T03:00:00.000Z"
const OCCURRED = new Date("2026-11-13T03:00:05.000Z")

/** One raw row as each provider's intake stores it (the same declared fields, the provider's own values). */
const ROWS = {
    sepay: { transactionId: "sp-1", amount: 250000, direction: "credit", content: "DH0042 thanh toan", account: "0123456789", bankRef: "FT26317", at: AT, source: "webhook", payer: "Nguyen A" },
    casso: { transactionId: "cs-1", amount: 99000, direction: "credit", content: "DH0043", account: "9988776655", bankRef: "CS-77", at: AT, source: "poll" },
    payos: { transactionId: "po-1", amount: 120000, direction: "credit", content: "DH0044", at: AT, source: "webhook" },
} as const

describe("creditOf: the raw bank row as the neutral credit", () => {
    it.each(Object.entries(ROWS))("%s: the row becomes { id, direction, amountVnd, content, at, account?, bankRef? }", (_provider, value) => {
        const credit = creditOf("row-1", value, OCCURRED)
        expect(credit).toEqual({
            id: "row-1",
            direction: "in",
            amountVnd: value.amount,
            content: value.content,
            at: AT,
            ...("account" in value ? { account: value.account } : {}),
            ...("bankRef" in value ? { bankRef: value.bankRef } : {}),
        })
    })

    it("leaves a member the row lacks out, never null; no payer, no source, no provider id", () => {
        const credit = creditOf("row-1", ROWS.payos, OCCURRED)
        expect(credit).not.toHaveProperty("account")
        expect(credit).not.toHaveProperty("bankRef")
        expect(credit).not.toHaveProperty("payer")
        expect(credit).not.toHaveProperty("transactionId")
        expect(creditOf("row-1", ROWS.sepay, OCCURRED)).not.toHaveProperty("payer")
    })

    it("says `out` for a debit, and the moment the row entered when the row holds no `at`", () => {
        expect(creditOf("row-2", { ...ROWS.sepay, direction: "debit" }, OCCURRED)).toMatchObject({ direction: "out" })
        const { at: _at, ...noAt } = ROWS.sepay
        expect(creditOf("row-2", noAt, OCCURRED)).toMatchObject({ at: OCCURRED.toISOString() })
    })

    it("is null for a row that is no bank move (no amount, no content, a direction that is neither)", () => {
        expect(creditOf("r", { ...ROWS.sepay, amount: "x" }, OCCURRED)).toBeNull()
        expect(creditOf("r", { ...ROWS.sepay, content: 5 }, OCCURRED)).toBeNull()
        expect(creditOf("r", { ...ROWS.sepay, direction: "sideways" }, OCCURRED)).toBeNull()
        expect(creditOf("r", {}, OCCURRED)).toBeNull()
    })

    it("fills from the SAME declaration as the bank trigger: its fill and the tool agree on every member the trigger declares", () => {
        const filled = declaredPayloadOf(TRIGGER.paymentCreditReceived, ROWS.sepay)
        const credit = creditOf("row-1", ROWS.sepay, OCCURRED)
        expect(credit).toMatchObject(filled)
    })
})

describe("the arguments of credit.get", () => {
    it("takes the raw row id, nothing else", () => {
        expect(CREDIT_GET_SCHEMA.safeParse({ transactionId: "row-1" }).success).toBe(true)
        expect(CREDIT_GET_SCHEMA.safeParse({ transactionId: "" }).success).toBe(false)
        expect(CREDIT_GET_SCHEMA.safeParse({ transactionId: "x".repeat(129) }).success).toBe(false)
        expect(CREDIT_GET_SCHEMA.safeParse({}).success).toBe(false)
        expect(CREDIT_GET_SCHEMA.safeParse({ transactionId: "r", extra: 1 }).success).toBe(false)
    })
})
})
