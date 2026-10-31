import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDrainService } from "@modules/domain/agent-work"
import { AgentDrainJobService } from "./agent-drain-job.service"
import { AgentSchedulesErrorCode } from "./errors/agent-schedules.error"

const PAYLOAD = { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "conversation:conv-1" }

const build = async () => {
    const drain = mock<AgentDrainService>({ drain: jest.fn().mockResolvedValue(undefined) })
    const container = await Test.createTestingModule({
        providers: [AgentDrainJobService, { provide: AgentDrainService, useValue: drain }],
    }).compile()
    return { service: container.get(AgentDrainJobService), drain }
}

describe("AgentDrainJobService.run", () => {
    it("drains the scope a drain job names", async () => {
        const { service, drain } = await build()

        await service.run(PAYLOAD)

        expect(drain.drain).toHaveBeenCalledWith(PAYLOAD)
    })

    it("ends a job whose payload names no scope, with no retry and no turn", async () => {
        const { service, drain } = await build()

        await expect(service.run({ agentId: "agent-1" })).rejects.toMatchObject({
            code: AgentSchedulesErrorCode.DrainPayloadInvalid,
            params: { unrecoverable: 1 },
        })
        expect(drain.drain).not.toHaveBeenCalled()
    })
})
