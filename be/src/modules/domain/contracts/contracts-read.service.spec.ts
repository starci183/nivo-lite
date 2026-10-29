import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Between, In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContractsReadService } from "./contracts-read.service"
import { ContractEntity } from "./persistence/entities"

const FACTS = {
    id: "c-1",
    customerName: "Acme",
    leadId: null,
    plan: "Pro",
    endsOn: "2026-11-30",
    amountVnd: 1000000,
    status: "active",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ContractsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ContractsReadService)
}

describe("ContractsReadService", () => {
    it("reads one contract of the workspace by its id", async () => {
        const em = mockEntityManager()
        em.find.mockResolvedValue([FACTS])

        await expect((await build(em)).contractById("ws-1", "c-1")).resolves.toEqual(FACTS)
        expect(em.find).toHaveBeenCalledWith(
            ContractEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", id: "c-1" }, take: 1 }),
        )
    })

    it("answers none when the workspace has no such contract", async () => {
        const em = mockEntityManager()
        em.find.mockResolvedValue([])

        await expect((await build(em)).contractById("ws-1", "c-9")).resolves.toBeUndefined()
    })

    it("reads the contracts of the workspace by their ids, bounded", async () => {
        const em = mockEntityManager()
        em.find.mockResolvedValue([FACTS])

        await expect((await build(em)).contractsByIds("ws-1", ["c-1"], 50)).resolves.toEqual([FACTS])
        expect(em.find).toHaveBeenCalledWith(
            ContractEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", id: In(["c-1"]) }, take: 50 }),
        )
    })

    it("reads the active contracts ending between two days, soonest first", async () => {
        const em = mockEntityManager()
        em.find.mockResolvedValue([FACTS])

        await expect((await build(em)).activeEndingBetween("ws-1", "2026-11-01", "2026-11-30", 100)).resolves.toEqual([
            FACTS,
        ])
        expect(em.find).toHaveBeenCalledWith(
            ContractEntity,
            expect.objectContaining({
                where: { workspaceId: "ws-1", status: "active", endsOn: Between("2026-11-01", "2026-11-30") },
                order: { endsOn: "ASC", customerName: "ASC" },
                take: 100,
            }),
        )
    })
})
