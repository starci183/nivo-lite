import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { StaffDirectoryService } from "./staff-directory.service"
import { In } from "typeorm"
import { StaffEntity } from "./persistence/entities"

const MAI = { id: "staff-1", name: "Mai" }

const staffOf = (record: Pick<StaffEntity, "id" | "name">): StaffEntity => Object.assign(new StaffEntity(), record)

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [StaffDirectoryService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(StaffDirectoryService)
}

describe("StaffDirectoryService", () => {
    describe("list", () => {
        it("lists the active staff, at most 200", async () => {
            const em = mockEntityManager({ find: [StaffEntity, [staffOf(MAI)]] })

            await expect((await build(em)).list("ws-1")).resolves.toEqual([MAI])
            expect(em.find).toHaveBeenCalledWith(StaffEntity, {
                select: { id: true, name: true },
                where: { workspaceId: "ws-1", active: true },
                order: { createdAt: "ASC", id: "ASC" },
                take: 200,
            })
        })
    })

    describe("activeCount", () => {
        it("counts the active staff of the workspace", async () => {
            const em = mockEntityManager({ count: [StaffEntity, 4] })

            await expect((await build(em)).activeCount("ws-1")).resolves.toBe(4)
            expect(em.count).toHaveBeenCalledWith(StaffEntity, { where: { workspaceId: "ws-1", active: true } })
        })
    })

    describe("namesOf", () => {
        it("asks for nothing when no one is assigned", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).namesOf("ws-1", [])).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })

        it("names the assigned people, including inactive staff", async () => {
            const ids = ["staff-1", "staff-2"]
            const em = mockEntityManager({
                find: [StaffEntity, [staffOf(MAI), staffOf({ id: "staff-2", name: "Lan" })]],
            })

            await expect((await build(em)).namesOf("ws-1", ids)).resolves.toEqual([MAI, { id: "staff-2", name: "Lan" }])
            expect(em.find).toHaveBeenCalledWith(StaffEntity, {
                select: { id: true, name: true },
                where: { workspaceId: "ws-1", id: In(ids) },
                take: 2,
            })
        })
    })
})
