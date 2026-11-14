import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { workspaceRow } from "@tests/fixtures/builders/workspaces.builder"
import { WorkspaceTimeZoneService } from "./workspace-time-zone.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspaceTimeZoneService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkspaceTimeZoneService)
}

describe("WorkspaceTimeZoneService", () => {
    it("answers the time zone the workspace row holds, read by the workspace id", async () => {
        const em = mockEntityManager({ findOne: [WorkspaceEntity, workspaceRow({ timeZone: "Asia/Bangkok" })] })
        const service = await build(em)
        await expect(service.timeZoneOf("ws-1")).resolves.toBe("Asia/Bangkok")
        expect(em.findOne).toHaveBeenCalledWith(WorkspaceEntity, {
            select: { id: true, timeZone: true },
            where: { id: "ws-1" },
        })
    })

    it("answers Asia/Ho_Chi_Minh for a workspace the core does not know, or when the stored name is not a zone", async () => {
        const none = await build(mockEntityManager({ findOne: [WorkspaceEntity, null] }))
        await expect(none.timeZoneOf("ws-1")).resolves.toBe("Asia/Ho_Chi_Minh")
        const bad = await build(
            mockEntityManager({ findOne: [WorkspaceEntity, workspaceRow({ timeZone: "Mars/Olympus" })] }),
        )
        await expect(bad.timeZoneOf("ws-1")).resolves.toBe("Asia/Ho_Chi_Minh")
    })

    it("factsOf: the zone, the brand name before the name, and the logo only when one is saved", async () => {
        const branded = await build(
            mockEntityManager({
                findOne: [WorkspaceEntity, workspaceRow({ timeZone: "Asia/Bangkok", name: "ws", displayName: "Ti\u1ec7m Hoa", logoUrl: "https://x/l.png" })],
            }),
        )
        await expect(branded.factsOf("ws-1")).resolves.toEqual({ timeZone: "Asia/Bangkok", name: "Ti\u1ec7m Hoa", logo: "https://x/l.png" })
        const plain = await build(
            mockEntityManager({ findOne: [WorkspaceEntity, workspaceRow({ name: "Hoa Mai", displayName: null, logoUrl: null })] }),
        )
        await expect(plain.factsOf("ws-1")).resolves.toEqual({ timeZone: "Asia/Ho_Chi_Minh", name: "Hoa Mai" })
        const none = await build(mockEntityManager({ findOne: [WorkspaceEntity, null] }))
        await expect(none.factsOf("ws-1")).resolves.toEqual({ timeZone: "Asia/Ho_Chi_Minh", name: "" })
    })
})
