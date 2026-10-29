import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { IsNull, MoreThanOrEqual, Not } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AppErrorsReadService } from "./app-errors-read.service"
import { AppErrorEntity } from "./persistence/entities"

const WHEN = new Date("2026-10-02T00:00:00.000Z")
const error = Object.assign(new AppErrorEntity(), {
    id: "e-1",
    scope: "api.x",
    message: "boom",
    workspaceId: "ws-1",
    createdAt: WHEN,
})
const ROW = { id: "e-1", scope: "api.x", message: "boom", workspaceId: "ws-1", createdAt: WHEN }
const COLUMNS = { id: true, scope: true, message: true, workspaceId: true, createdAt: true }

const build = async () => {
    const em = mockEntityManager({ find: [AppErrorEntity, [error]] })
    const moduleRef = await Test.createTestingModule({
        providers: [AppErrorsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { em, service: moduleRef.get(AppErrorsReadService) }
}

describe("AppErrorsReadService", () => {
    it("reads the workspaces of the errors captured since an instant", async () => {
        const { em, service } = await build()

        await expect(service.workspacesSince(WHEN, 5000)).resolves.toEqual(["ws-1"])
        expect(em.find).toHaveBeenCalledWith(AppErrorEntity, {
            select: { workspaceId: true },
            where: { createdAt: MoreThanOrEqual(WHEN), workspaceId: Not(IsNull()) },
            take: 5000,
        })
    })

    it("reads the newest errors of one workspace", async () => {
        const { em, service } = await build()

        await expect(service.latestOfWorkspace("ws-1", 20)).resolves.toEqual([ROW])
        expect(em.find).toHaveBeenCalledWith(AppErrorEntity, {
            select: COLUMNS,
            where: { workspaceId: "ws-1" },
            order: { createdAt: "DESC" },
            take: 20,
        })
    })

    it("reads the newest errors of every workspace", async () => {
        const { em, service } = await build()

        await expect(service.latest(50)).resolves.toEqual([ROW])
        expect(em.find).toHaveBeenCalledWith(AppErrorEntity, {
            select: COLUMNS,
            order: { createdAt: "DESC" },
            take: 50,
        })
    })

    it("counts the errors since an instant by scope, most first", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getRawMany: [{ scope: "api.x", count: 2 }] }])
        const moduleRef = await Test.createTestingModule({
            providers: [AppErrorsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
        }).compile()

        await expect(moduleRef.get(AppErrorsReadService).scopesSince(WHEN, 100)).resolves.toEqual([
            { scope: "api.x", count: 2 },
        ])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(AppErrorEntity, "e")
        expect(read?.callsOf("where")).toEqual([["e.createdAt >= :since", { since: WHEN }]])
        expect(read?.callsOf("orderBy")).toEqual([["count", "DESC"]])
        expect(read?.callsOf("limit")).toEqual([[100]])
    })
})
