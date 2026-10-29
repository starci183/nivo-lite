import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { EngineStatusService } from "@modules/domain/agents"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentSyncChecksService } from "./agent-sync-checks.service"
import { OpenclawAgentSyncEntity } from "./persistence/entities"

const build = async (latest: OpenclawAgentSyncEntity | null) => {
    const em = mockEntityManager({ findOne: [OpenclawAgentSyncEntity, latest] })
    const engine = mock<EngineStatusService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentSyncChecksService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: EngineStatusService, useValue: engine },
        ],
    }).compile()
    return { service: moduleRef.get(AgentSyncChecksService), em, engine }
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

    it("answers the engine status, handing the engine the check time to read after membership", async () => {
        const status = { gatewayConfigured: true, workspaceWritable: true, lastSyncCheckAt: null, syncFresh: false }
        const { service, engine } = await build(null)
        engine.status.mockImplementation(async (_userId, _workspaceId, lastSyncCheck) => {
            await expect(lastSyncCheck()).resolves.toBeNull()
            return status
        })

        await expect(service.engineStatus("u1", "w1")).resolves.toBe(status)
        expect(engine.status).toHaveBeenCalledWith("u1", "w1", expect.any(Function))
    })
})
