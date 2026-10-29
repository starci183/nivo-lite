import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ConnectionsAdminReadService } from "./connections-admin-read.service"
import { ConnectionEntity } from "./persistence/entities"

const WHEN = new Date("2026-10-02T00:00:00.000Z")
const connection = Object.assign(new ConnectionEntity(), {
    id: "c-1",
    workspaceId: "ws-1",
    provider: "zalo",
    name: "Shop",
    status: "connected",
    environment: "live",
    lastEventAt: WHEN,
    lastError: null,
    createdAt: WHEN,
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ConnectionsAdminReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ConnectionsAdminReadService)
}

describe("ConnectionsAdminReadService", () => {
    it("reads every connection that is not disconnected, bounded", async () => {
        const em = mockEntityManager({ find: [ConnectionEntity, [connection]] })

        await expect((await build(em)).live(5000)).resolves.toEqual([
            {
                workspaceId: "ws-1",
                provider: "zalo",
                status: "connected",
                environment: "live",
                lastEventAt: WHEN,
                createdAt: WHEN,
            },
        ])
        expect(em.find).toHaveBeenCalledWith(
            ConnectionEntity,
            expect.objectContaining({ where: { status: Not("disconnected") }, take: 5000 }),
        )
    })

    it("reads the connections of a workspace, oldest first", async () => {
        const em = mockEntityManager({ find: [ConnectionEntity, [connection]] })

        await expect((await build(em)).ofWorkspace("ws-1", 200)).resolves.toEqual([
            {
                id: "c-1",
                provider: "zalo",
                name: "Shop",
                status: "connected",
                environment: "live",
                lastEventAt: WHEN,
                lastError: null,
                createdAt: WHEN,
            },
        ])
        expect(em.find).toHaveBeenCalledWith(
            ConnectionEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1" }, order: { createdAt: "ASC" }, take: 200 }),
        )
    })
})
