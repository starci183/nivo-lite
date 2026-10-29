import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { InvoicesAutomationReadService } from "./invoices-automation-read.service"

const build = async (answers: ReadonlyArray<QueryBuilderAnswers>) => {
    const entityManager = mockEntityManager()
    const fakes = queueQueryBuilders(entityManager, answers)
    const moduleRef = await Test.createTestingModule({
        providers: [InvoicesAutomationReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(InvoicesAutomationReadService), fakes, entityManager }
}

describe("InvoicesAutomationReadService", () => {
    it("lists the issued invoices due before the cutoff, oldest first and bounded", async () => {
        const rows = [{ id: "i1", invoice_no: "HD-1" }]
        const { service, fakes } = await build([{ getRawMany: rows }])

        await expect(service.debtInvoices("ws-1", "2026-10-01T00:00:00.000Z")).resolves.toBe(rows)
        expect(fakes[0]?.callsOf("orderBy")).toEqual([["i.due_at", "ASC"]])
        expect(fakes[0]?.callsOf("limit")).toEqual([[50]])
    })

    it("totals the money paid since the start of the day, zero when nothing answers", async () => {
        const { service, entityManager } = await build([{ getRawOne: { total: "900000" } }, { getRawOne: undefined }])

        await expect(service.paidTotalSince("ws-1", "2026-10-12", entityManager)).resolves.toBe("900000")
        await expect(service.paidTotalSince("ws-1", "2026-10-12", entityManager)).resolves.toBe(0)
    })
})
