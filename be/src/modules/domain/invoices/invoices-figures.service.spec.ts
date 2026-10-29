import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { InvoicesFiguresService } from "./invoices-figures.service"
import { InvoiceEntity } from "./persistence/entities"

const invoiceOf = entityOf(InvoiceEntity, {
    id: "i1",
    workspaceId: "ws-1",
    orderId: "o1",
    leadId: "l1",
    invoiceNo: "INV-1",
    amountVnd: 200000,
    status: "issued",
})

describe("InvoicesFiguresService", () => {
    it("lists the issued and paid invoices of the workspace", async () => {
        const em = mockEntityManager({ find: [InvoiceEntity, [invoiceOf()]] })
        const moduleRef = await Test.createTestingModule({
            providers: [InvoicesFiguresService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(InvoicesFiguresService).issuedOrPaid("ws-1")).resolves.toEqual([
            { id: "i1", orderId: "o1", leadId: "l1", invoiceNo: "INV-1", amountVnd: 200000, status: "issued" },
        ])
        expect(em.find).toHaveBeenCalledWith(InvoiceEntity, {
            select: { id: true, orderId: true, leadId: true, invoiceNo: true, amountVnd: true, status: true },
            where: { workspaceId: "ws-1", status: In(["issued", "paid"]) },
        })
    })
})
