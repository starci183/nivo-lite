import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentWakeService } from "@modules/domain/agent-work"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IntentSplitService } from "./intent-split.service"
import type { WakeRow } from "./agent-turns.contracts"

const wake: WakeRow = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    scopeKey: "conversation:conv-1",
    wakeId: "wake-1",
    turnId: "turn-1",
    source: "customer",
    eventKey: "msg-1",
    context: { conversationId: "conv-1", messageId: "msg-1", channelEventId: "ev-1" },
    actorMemberId: null,
    attempts: 1,
    maxAttempts: 2,
    wakeCreatedAt: "2026-11-01T10:00:00.000Z",
}

const build = async (written: boolean) => {
    const tx = fakeTransaction(mockEntityManager())
    const wakes = mock<AgentWakeService>({ wake: jest.fn(() => Promise.resolve(written)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            IntentSplitService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AgentWakeService, useValue: wakes },
        ],
    }).compile()
    return { service: moduleRef.get(IntentSplitService), wakes }
}

describe("IntentSplitService", () => {
    it("writes the follow-up wake in one transaction: same facts, pinned, under the key of the split", async () => {
        const { service, wakes } = await build(true)

        await expect(service.fire(wake, "confirm_order")).resolves.toBe(true)

        expect(wakes.wake).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "customer",
            eventKey: "intent:wake-1:confirm_order",
            context: { ...wake.context, intent: "confirm_order" },
            actorMemberId: null,
        })
    })

    it("answers false when the same split was already written", async () => {
        const { service } = await build(false)

        await expect(service.fire(wake, "confirm_order")).resolves.toBe(false)
    })
})
