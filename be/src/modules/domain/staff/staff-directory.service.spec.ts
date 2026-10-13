import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { StaffDirectoryService } from "./staff-directory.service"
import { LIST_ACTIVE_STAFF, LIST_STAFF_NAMES } from "./persistence/staff.sql"

const MAI = { id: "staff-1", name: "Mai" }

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [StaffDirectoryService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(StaffDirectoryService)
}

describe("StaffDirectoryService", () => {
    describe("list", () => {
        it("lists the active staff, at most 200", async () => {
            const em = mockEntityManager({ query: [LIST_ACTIVE_STAFF, [MAI]] })

            await expect((await build(em)).list("ws-1")).resolves.toEqual([MAI])
            expect(em.query).toHaveBeenCalledWith(LIST_ACTIVE_STAFF, ["ws-1", 200])
        })
    })

    describe("namesOf", () => {
        it("asks for nothing when no one is assigned", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).namesOf("ws-1", [])).resolves.toEqual([])
            expect(em.query).not.toHaveBeenCalled()
        })

        it("names the assigned people, including inactive staff", async () => {
            const ids = ["staff-1", "staff-2"]
            const em = mockEntityManager({ query: [LIST_STAFF_NAMES, [MAI, { id: "staff-2", name: "Lan" }]] })

            await expect((await build(em)).namesOf("ws-1", ids)).resolves.toEqual([MAI, { id: "staff-2", name: "Lan" }])
            expect(em.query).toHaveBeenCalledWith(LIST_STAFF_NAMES, ["ws-1", ids, 2])
        })
    })
})
