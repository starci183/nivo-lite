import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspaceEntity } from "./persistence/entities"
import { WorkspaceAdminReadService } from "./workspace-admin-read.service"

const CREATED = new Date("2026-10-01T00:00:00.000Z")
const ENTITY = Object.assign(new WorkspaceEntity(), {
    id: "ws-1",
    ownerId: "u-1",
    name: "Spa",
    status: "active",
    planCode: "pro",
    paidUntil: null,
    createdAt: CREATED,
})
const ROW = {
    id: "ws-1",
    ownerId: "u-1",
    name: "Spa",
    status: "active",
    planCode: "pro",
    paidUntil: null,
    createdAt: CREATED,
}
const COLUMNS = { id: true, ownerId: true, name: true, status: true, planCode: true, paidUntil: true, createdAt: true }

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspaceAdminReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkspaceAdminReadService)
}

describe("WorkspaceAdminReadService", () => {
    it("lists the newest workspaces first, bounded", async () => {
        const em = mockEntityManager({ find: [WorkspaceEntity, [ENTITY]] })

        await expect((await build(em)).newest(1000)).resolves.toEqual([ROW])
        expect(em.find).toHaveBeenCalledWith(WorkspaceEntity, {
            select: COLUMNS,
            order: { createdAt: "DESC" },
            take: 1000,
        })
    })

    it("finds one workspace and answers undefined when it is gone", async () => {
        const found = mockEntityManager({ findOne: [WorkspaceEntity, ENTITY] })
        const gone = mockEntityManager({ findOne: [WorkspaceEntity, null] })

        await expect((await build(found)).find("ws-1")).resolves.toEqual(ROW)
        expect(found.findOne).toHaveBeenCalledWith(WorkspaceEntity, { select: COLUMNS, where: { id: "ws-1" } })
        await expect((await build(gone)).find("ws-9")).resolves.toBeUndefined()
    })

    it("names the given workspaces and reads nothing for no ids", async () => {
        const em = mockEntityManager({ find: [WorkspaceEntity, [ENTITY]] })
        const service = await build(em)

        await expect(service.namesOf([], 500)).resolves.toEqual([])
        expect(em.find).not.toHaveBeenCalled()
        await expect(service.namesOf(["ws-1"], 500)).resolves.toEqual([{ id: "ws-1", name: "Spa" }])
        expect(em.find).toHaveBeenCalledWith(WorkspaceEntity, {
            select: { id: true, name: true },
            where: { id: In(["ws-1"]) },
            take: 500,
        })
    })
})
