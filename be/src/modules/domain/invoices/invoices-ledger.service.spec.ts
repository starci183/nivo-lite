import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LessThan } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InvoicesLedgerService } from "./invoices-ledger.service"
import { InvoiceEntity } from "./persistence/entities"

const FROM = new Date("2026-10-01T00:00:00Z")
const TO = new Date("2026-11-01T00:00:00Z")

const invoice = (overrides: Partial<InvoiceEntity>): InvoiceEntity =>
    Object.assign(new InvoiceEntity(), {
        id: "i-1",
        invoiceNo: "HD1",
        amountVnd: 1000,
        leadId: "l-1",
        dueAt: FROM,
        issuedAt: FROM,
        paidAt: null,
        status: "issued",
        ...overrides,
    })

const build = async (
    answers: ReadonlyArray<QueryBuilderAnswers> = [],
    em: MockEntityManager = mockEntityManager(),
) => {
    const fakes = queueQueryBuilders(em, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [InvoicesLedgerService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { ledger: moduleRef.get(InvoicesLedgerService), em, fakes }
}

describe("InvoicesLedgerService", () => {
    describe("issuedTally", () => {
        it("counts the invoices issued in the period and sums their amounts", async () => {
            const { ledger, em, fakes } = await build([{ getRawOne: { total: 2, amount: "700000" } }])

            await expect(ledger.issuedTally("ws-1", FROM, TO)).resolves.toEqual({ total: 2, amount: 700000 })

            expect(em.createQueryBuilder).toHaveBeenCalledWith(InvoiceEntity, "i")
            expect(fakes[0]?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", from: FROM, to: TO })
        })

        it("answers zero when the read answers nothing", async () => {
            const { ledger } = await build([{ getRawOne: undefined }])

            await expect(ledger.issuedTally("ws-1", FROM, TO)).resolves.toEqual({ total: 0, amount: 0 })
        })
    })

    describe("overdueTally", () => {
        it("counts the issued invoices due before the instant", async () => {
            const { ledger, fakes } = await build([{ getRawOne: { total: 1, amount: 200000 } }])

            await expect(ledger.overdueTally("ws-1", TO)).resolves.toEqual({ total: 1, amount: 200000 })

            expect(fakes[0]?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", before: TO })
        })
    })

    describe("overdueBefore", () => {
        it("lists the issued invoices due before the cutoff, oldest due first, bounded", async () => {
            const { ledger, em } = await build([], mockEntityManager({ find: [InvoiceEntity, [invoice({})]] }))

            await expect(ledger.overdueBefore("ws-1", TO, 200)).resolves.toEqual([
                { id: "i-1", invoiceNo: "HD1", amountVnd: 1000, dueAt: FROM, leadId: "l-1" },
            ])

            expect(em.find).toHaveBeenCalledWith(InvoiceEntity, {
                select: { id: true, invoiceNo: true, amountVnd: true, dueAt: true, leadId: true },
                where: { workspaceId: "ws-1", status: "issued", dueAt: LessThan(TO) },
                order: { dueAt: "ASC" },
                take: 200,
            })
        })
    })

    describe("issuedLedger", () => {
        it("lists the non-draft invoices issued in the period, earliest first, bounded", async () => {
            const { ledger, fakes } = await build([{ getMany: [invoice({})] }])

            await expect(ledger.issuedLedger("ws-1", FROM, TO, 5000)).resolves.toEqual([
                { invoiceNo: "HD1", amountVnd: 1000, issuedAt: FROM, status: "issued" },
            ])

            expect(fakes[0]?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", from: FROM, to: TO })
            expect(fakes[0]?.callsOf("limit")).toEqual([[5000]])
        })
    })

    describe("receiptInvoice", () => {
        it("answers the invoice of the workspace, or null when there is none", async () => {
            const found = await build([], mockEntityManager({ findOne: [InvoiceEntity, invoice({ paidAt: TO })] }))
            const missing = await build([], mockEntityManager({ findOne: [InvoiceEntity, null] }))

            await expect(found.ledger.receiptInvoice("ws-1", "i-1")).resolves.toEqual({
                id: "i-1",
                invoiceNo: "HD1",
                amountVnd: 1000,
                leadId: "l-1",
                paidAt: TO,
            })
            await expect(missing.ledger.receiptInvoice("ws-1", "i-1")).resolves.toBeNull()
        })
    })
})
