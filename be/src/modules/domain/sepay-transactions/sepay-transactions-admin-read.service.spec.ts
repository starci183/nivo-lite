import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { SepayTransactionEntity } from "./persistence/entities"
import { SepayTransactionsAdminReadService } from "./sepay-transactions-admin-read.service"

const WHEN = new Date("2026-10-02T00:00:00.000Z")
const transfer = Object.assign(new SepayTransactionEntity(), {
    sepayId: 7,
    transferAmount: 500000,
    content: "NIVO1",
    status: "matched",
    receivedAt: WHEN,
})
const ROW = { sepayId: 7, transferAmount: 500000, content: "NIVO1", status: "matched", receivedAt: WHEN }
const COLUMNS = { sepayId: true, transferAmount: true, content: true, status: true, receivedAt: true }

const build = async () => {
    const em = mockEntityManager({ find: [SepayTransactionEntity, [transfer]] })
    const moduleRef = await Test.createTestingModule({
        providers: [SepayTransactionsAdminReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { em, service: moduleRef.get(SepayTransactionsAdminReadService) }
}

describe("SepayTransactionsAdminReadService", () => {
    it("reads the transfers of the given orders, newest first, and nothing for no orders", async () => {
        const { em, service } = await build()

        await expect(service.matchedTo([], 30)).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
        await expect(service.matchedTo(["o-1"], 30)).resolves.toEqual([ROW])
        expect(em.find).toHaveBeenCalledWith(SepayTransactionEntity, {
            select: COLUMNS,
            where: { matchedOrderId: In(["o-1"]) },
            order: { receivedAt: "DESC" },
            take: 30,
        })
    })

    it("reads the newest transfers", async () => {
        const { em, service } = await build()

        await expect(service.latest(25)).resolves.toEqual([ROW])
        expect(em.find).toHaveBeenCalledWith(SepayTransactionEntity, {
            select: COLUMNS,
            order: { receivedAt: "DESC" },
            take: 25,
        })
    })
})
