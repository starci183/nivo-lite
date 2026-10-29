import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentSyncChecksService } from "./agent-sync-checks.service"
import { OpenclawAgentSyncEntity } from "./persistence/entities"

const build = async (latest: OpenclawAgentSyncEntity | null) => {
    const em = mockEntityManager({ findOne: [OpenclawAgentSyncEntity, latest] })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentSyncChecksService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(AgentSyncChecksService), em }
}

describe("AgentSyncChecksService", () => {
    it("answers the newest check time of the workspace as ISO text", async () => {
        const row = Object.assign(new OpenclawAgentSyncEntity(), { checkedAt: new Date("2026-10-12T09:55:00.000Z") })
        const { service, em } = await build(row)

        await expect(service.lastCheckAt("w1")).resolves.toBe("2026-10-12T09:55:00.000Z")
        expect(em.findOne).toHaveBeenCalledWith(OpenclawAgentSyncEntity, {
            select: { checkedAt: true },
            where: { workspaceId: "w1" },
            order: { checkedAt: "DESC" },
        })
    })

    it("answers null when the workspace was never checked", async () => {
        const { service } = await build(null)

        await expect(service.lastCheckAt("w1")).resolves.toBeNull()
    })
})
