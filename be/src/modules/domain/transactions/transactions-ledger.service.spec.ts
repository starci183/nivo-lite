import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TransactionEntity } from "./persistence/entities"
import { TransactionsLedgerService } from "./transactions-ledger.service"

const FROM = new Date("2026-10-01T00:00:00Z")
const TO = new Date("2026-11-01T00:00:00Z")

const payment = (): TransactionEntity =>
    Object.assign(new TransactionEntity(), {
        id: "t-1",
        amountVnd: 100000,
        reference: "R1",
        payer: "An",
        channel: "bank",
        status: "matched",
        occurredAt: FROM,
        invoiceId: "i-1",
    })

const build = async (answers: ReadonlyArray<QueryBuilderAnswers> = [], em: MockEntityManager = mockEntityManager()) => {
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [TransactionsLedgerService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { ledger: moduleRef.get(TransactionsLedgerService), em, fakes }
}

describe("TransactionsLedgerService", () => {
    describe("creditTally", () => {
        it("counts the credits of the period and sums their amounts", async () => {
            const { ledger, em, fakes } = await build([{ getRawOne: { total: 1, amount: "500000" } }])

            await expect(ledger.creditTally("ws-1", FROM, TO)).resolves.toEqual({ total: 1, amount: 500000 })

            expect(em.createQueryBuilder).toHaveBeenCalledWith(TransactionEntity, "t")
            expect(fakes[0]?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", from: FROM, to: TO })
        })

        it("answers zero when the read answers nothing", async () => {
            const { ledger } = await build([{ getRawOne: undefined }])

            await expect(ledger.creditTally("ws-1", FROM, TO)).resolves.toEqual({ total: 0, amount: 0 })
        })
    })

    describe("creditLedger", () => {
        it("lists the credits of the period, earliest first, bounded", async () => {
            const { ledger, fakes } = await build([{ getMany: [payment()] }])

            await expect(ledger.creditLedger("ws-1", FROM, TO, 5000)).resolves.toEqual([
                {
                    occurredAt: FROM,
                    amountVnd: 100000,
                    reference: "R1",
                    payer: "An",
                    channel: "bank",
                    status: "matched",
                },
            ])

            expect(fakes[0]?.callsOf("limit")).toEqual([[5000]])
        })
    })

    describe("receiptPayment", () => {
        it("answers the payment of the workspace, or null when there is none", async () => {
            const found = await build([], mockEntityManager({ findOne: [TransactionEntity, payment()] }))
            const missing = await build([], mockEntityManager({ findOne: [TransactionEntity, null] }))

            await expect(found.ledger.receiptPayment("ws-1", "t-1")).resolves.toEqual({
                invoiceId: "i-1",
                amountVnd: 100000,
                occurredAt: FROM,
            })
            await expect(missing.ledger.receiptPayment("ws-1", "t-1")).resolves.toBeNull()
        })
    })
})
