import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    PAYABLE_PAID_AT,
    PAYABLE_WORKSPACE as WS,
    listedPayable,
    payableEntity,
    payableRow,
} from "../../../tests/fixtures/builders/supplier-payables.builder"
import { SupplierPayablesService } from "./supplier-payables.service"
import { SupplierPayableEntity } from "./persistence/entities"

const PAID_AT = new Date(PAYABLE_PAID_AT)

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [SupplierPayablesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(SupplierPayablesService)
}

const registerRecordWrites = () => {
    it("writes one row for an invoice seen for the first time and answers it open", async () => {
        const em = mockEntityManager({
            find: [
                [SupplierPayableEntity, []],
                [SupplierPayableEntity, [payableEntity()]],
            ],
            insert: [SupplierPayableEntity, {}],
        })
        const service = await build(em)

        await expect(service.record(WS, [listedPayable()])).resolves.toEqual([payableRow()])

        expect(em.insert).toHaveBeenCalledTimes(1)
        expect(em.insert).toHaveBeenCalledWith(SupplierPayableEntity, [
            expect.objectContaining({ workspaceId: WS, invoiceNo: "17", amountVnd: "4620000", dueOn: "2026-10-31" }),
        ])
    })

    it("rewrites an open row whose amount or due date moved, and only while it is open", async () => {
        const em = mockEntityManager({
            find: [SupplierPayableEntity, [payableEntity()]],
            update: [SupplierPayableEntity, { affected: 1 }],
        })
        const service = await build(em)

        await service.record(WS, [listedPayable({ amountVnd: 5_000_000, dueOn: "2026-11-02" })])

        expect(em.insert).not.toHaveBeenCalled()
        expect(em.update).toHaveBeenCalledWith(
            SupplierPayableEntity,
            { workspaceId: WS, sellerTaxCode: "0100109106", invoiceNo: "17", status: "open" },
            { supplier: "Linh An", amountVnd: "5000000", issuedOn: "2026-10-01", dueOn: "2026-11-02" },
        )
    })
}

const registerRecordQuiet = () => {
    it("writes nothing for a repeat of an invoice that did not change", async () => {
        const em = mockEntityManager({ find: [SupplierPayableEntity, [payableEntity()]] })
        const service = await build(em)

        await expect(service.record(WS, [listedPayable()])).resolves.toEqual([payableRow()])

        expect(em.insert).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })

    it("never touches a paid row", async () => {
        const paid = payableEntity({ status: "paid", debitRef: "d-1", paidAt: PAID_AT })
        const em = mockEntityManager({ find: [SupplierPayableEntity, [paid]] })
        const service = await build(em)

        const rows = await service.record(WS, [listedPayable({ amountVnd: 1 })])

        expect(rows).toEqual([payableRow({ status: "paid", debitRef: "d-1", paidAt: PAYABLE_PAID_AT })])
        expect(em.insert).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })

    it("reads and writes nothing when nothing is listed", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.record(WS, [])).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })
}

const registerReads = () => {
    it("lists the open invoices soonest due first", async () => {
        const em = mockEntityManager({ find: [SupplierPayableEntity, [payableEntity()]] })
        const service = await build(em)

        await expect(service.listOpen(WS)).resolves.toEqual([payableRow()])
        expect(em.find).toHaveBeenCalledWith(SupplierPayableEntity, {
            where: { workspaceId: WS, status: "open" },
            order: { dueOn: "ASC", invoiceNo: "ASC" },
            take: 500,
        })
    })

    it("lists the paid invoices latest first, bounded", async () => {
        const em = mockEntityManager({ find: [SupplierPayableEntity, []] })
        const service = await build(em)

        await expect(service.listPaid(WS)).resolves.toEqual([])
        expect(em.find).toHaveBeenCalledWith(SupplierPayableEntity, {
            where: { workspaceId: WS, status: "paid" },
            order: { paidAt: "DESC", id: "DESC" },
            take: 200,
        })
    })
}

const registerWrites = () => {
    it("remembers the work item that asks about the payment", async () => {
        const em = mockEntityManager({ update: [SupplierPayableEntity, { affected: 1 }] })
        const service = await build(em)

        await service.linkWork(WS, "pay-1", "wi-1")

        expect(em.update).toHaveBeenCalledWith(
            SupplierPayableEntity,
            { id: "pay-1", workspaceId: WS },
            { workItemId: "wi-1" },
        )
    })

    it("marks an open invoice paid once, and a retry changes nothing", async () => {
        const em = mockEntityManager({
            update: [
                [SupplierPayableEntity, { affected: 1 }],
                [SupplierPayableEntity, { affected: 0 }],
            ],
        })
        const service = await build(em)
        const mark = { debitRef: "d-1", paidAt: PAID_AT, workItemId: "wi-1", decidedBy: "Lan" }

        await expect(service.markPaid(WS, "pay-1", mark)).resolves.toBe(true)
        await expect(service.markPaid(WS, "pay-1", mark)).resolves.toBe(false)

        expect(em.update).toHaveBeenCalledWith(
            SupplierPayableEntity,
            { id: "pay-1", workspaceId: WS, status: "open" },
            { status: "paid", debitRef: "d-1", paidAt: PAID_AT, workItemId: "wi-1", decidedBy: "Lan" },
        )
    })
}

describe("SupplierPayablesService", () => {
    describe("record", () => {
        registerRecordWrites()
        registerRecordQuiet()
    })
    describe("reads", registerReads)
    describe("writes", registerWrites)
})
