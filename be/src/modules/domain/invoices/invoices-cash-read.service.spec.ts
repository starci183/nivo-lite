import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LessThan } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    cashInvoiceOf as invoiceOf,
    uncontractedInvoiceOf,
    undatedInvoiceOf,
} from "@tests/fixtures/builders/invoices-cash.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { InvoicesCashReadService } from "./invoices-cash-read.service"
import { InvoiceEntity } from "./persistence/entities"

const FROM = new Date("2026-10-01T00:00:00Z")
const TO = new Date("2026-11-01T00:00:00Z")

const cashOf = {
    invoiceNo: "HD1",
    amountVnd: 1000,
    contractId: "c-1",
    leadId: "l-1",
    periodEndsOn: "2026-12-31",
    issuedAt: FROM,
    dueAt: TO,
    paidAt: null,
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [InvoicesCashReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(InvoicesCashReadService)
}

describe("InvoicesCashReadService", () => {
    it("sums what was paid since an instant, zero when no row answers", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawOne: { total: "700000" } }, { getRawOne: undefined }])
        const service = await build(em)

        await expect(service.paidTotalSince("ws-1", FROM)).resolves.toBe(700000)
        await expect(service.paidTotalSince("ws-1", FROM)).resolves.toBe(0)
    })

    it("lists the renewal invoices issued and paid in a period", async () => {
        const em = mockEntityManager()
        const [issued, paid] = queueQueryBuilders(em, [{ getMany: [invoiceOf()] }, { getMany: [invoiceOf()] }])
        const service = await build(em)

        await expect(service.renewalsIssued("ws-1", FROM, TO, 5)).resolves.toEqual([cashOf])
        await expect(service.renewalsPaid("ws-1", FROM, TO, 5)).resolves.toEqual([cashOf])
        expect(issued?.callsOf("limit")).toEqual([[5]])
        expect(paid?.callsOf("limit")).toEqual([[5]])
    })

    it("lists the issued invoices that fall due before an instant", async () => {
        const em = mockEntityManager({ find: [InvoiceEntity, [invoiceOf()]] })

        await expect((await build(em)).unpaidDueBefore("ws-1", TO, 7)).resolves.toEqual([cashOf])
        expect(em.find).toHaveBeenCalledWith(
            InvoiceEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", status: "issued", dueAt: LessThan(TO) }, take: 7 }),
        )
    })

    it("reads the invoiced periods of contracts, skipping rows without a period, and nothing for no contracts", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getMany: [invoiceOf(), undatedInvoiceOf(), uncontractedInvoiceOf()] }])
        const service = await build(em)

        await expect(service.invoicedPeriods("ws-1", [])).resolves.toEqual([])
        await expect(service.invoicedPeriods("ws-1", ["c-1"])).resolves.toEqual([
            { contractId: "c-1", periodEndsOn: "2026-12-31" },
        ])
    })
})
