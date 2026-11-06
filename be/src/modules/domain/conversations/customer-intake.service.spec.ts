import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentWakeService } from "@modules/domain/agent-work"
import type { CustomerIntake } from "./conversations.contracts"
import { CustomerIntakeService } from "./customer-intake.service"

const INTAKE: CustomerIntake = {
    workspaceId: "ws-1",
    conversationId: "conv-1",
    messageId: "msg-1",
    channelEventId: "tg:c-1:555:9",
    lookupName: true,
    agentId: "agent-1",
}

const build = async () => {
    const wakes = mock<AgentWakeService>()
    wakes.wake.mockResolvedValue(true)
    const moduleRef = await Test.createTestingModule({
        providers: [CustomerIntakeService, { provide: AgentWakeService, useValue: wakes }],
    }).compile()
    return { service: moduleRef.get(CustomerIntakeService), wakes }
}

describe("CustomerIntakeService", () => {
    it("writes one customer wake for the agent that speaks, keyed by the message, in the caller's transaction", async () => {
        const manager = mockEntityManager()
        const { service, wakes } = await build()

        await service.answer(INTAKE, manager)

        expect(wakes.wake).toHaveBeenCalledWith(manager, {
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "customer",
            eventKey: "msg-1",
            context: {
                conversationId: "conv-1",
                messageId: "msg-1",
                channelEventId: "tg:c-1:555:9",
                lookupName: true,
            },
            actorMemberId: null,
        })
    })

    it("writes the same wake again for a message delivered twice, which the wake key keeps to one", async () => {
        const manager = mockEntityManager()
        const { service, wakes } = await build()
        wakes.wake.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

        await service.answer(INTAKE, manager)
        await service.answer(INTAKE, manager)

        expect(wakes.wake).toHaveBeenCalledTimes(2)
        expect(wakes.wake.mock.calls[0]?.[1]).toEqual(wakes.wake.mock.calls[1]?.[1])
    })
})
