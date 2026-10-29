import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { TransactionEntity } from "./persistence/entities"
import { TransactionsFiguresService } from "./transactions-figures.service"

const creditOf = entityOf(TransactionEntity, {
    id: "t1",
    workspaceId: "ws-1",
    invoiceId: "i1",
    payer: "An",
    reference: "REF1",
    amountVnd: 200000,
    status: "matched",
})

describe("TransactionsFiguresService", () => {
    it("lists the open credits of the workspace", async () => {
        const em = mockEntityManager({ find: [TransactionEntity, [creditOf()]] })
        const moduleRef = await Test.createTestingModule({
            providers: [TransactionsFiguresService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(TransactionsFiguresService).openCredits("ws-1")).resolves.toEqual([
            { id: "t1", invoiceId: "i1", payer: "An", reference: "REF1", amountVnd: 200000, status: "matched" },
        ])
        expect(em.find).toHaveBeenCalledWith(TransactionEntity, {
            select: { id: true, invoiceId: true, payer: true, reference: true, amountVnd: true, status: true },
            where: { workspaceId: "ws-1", direction: "credit", status: In(["matched", "unmatched", "needs_review"]) },
        })
    })
})
