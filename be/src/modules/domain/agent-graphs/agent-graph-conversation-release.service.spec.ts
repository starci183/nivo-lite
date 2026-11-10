import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChatConversationsService } from "@modules/domain/chat-records"
import type { ChatHumanConversation } from "@modules/domain/chat-records"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentGraphConversationHoldsService } from "./agent-graph-conversation-holds.service"
import type { OptionalConversationHold } from "./agent-graph-conversation-holds.service"
import { AgentGraphConversationReleaseService } from "./agent-graph-conversation-release.service"

const HOLD: OptionalConversationHold = {
    id: "hold-1",
    agentId: "agent-sales",
    runId: "run-1",
    heldAt: new Date("2026-11-11T01:00:00.000Z"),
    workflowId: "wf-consult",
}

const build = async (handledBy: string | null, hold: OptionalConversationHold, found = true) => {
    const conversations = mock<ChatConversationsService>({
        humanOf: jest
            .fn()
            .mockResolvedValue(found ? ({ id: "conv-1", handledBy, leadId: null } as unknown as ChatHumanConversation) : null),
        setHolder: jest.fn().mockResolvedValue(undefined),
    })
    const holds = mock<AgentGraphConversationHoldsService>({
        holderOf: jest.fn().mockResolvedValue(hold),
        free: jest.fn().mockResolvedValue(undefined),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphConversationReleaseService,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AgentGraphConversationHoldsService, useValue: holds },
            { provide: ChatConversationsService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphConversationReleaseService), conversations, holds }
}

describe("AgentGraphConversationReleaseService.release (hand back to the agent)", () => {
    it("clears a person's take-over through the conversation's writer and an agent's consult hold through the holds' own free", async () => {
        const { service, conversations, holds } = await build("Owner Lan", HOLD)

        await expect(service.release("ws-1", "conv-1", "both")).resolves.toEqual({
            outcome: "released",
            person: "Owner Lan",
            agentId: "agent-sales",
        })
        expect(conversations.setHolder).toHaveBeenCalledWith("ws-1", "conv-1", null)
        expect(holds.free).toHaveBeenCalledWith("ws-1", "conv-1", "agent-sales")
    })

    it("clears only the hold asked for", async () => {
        const person = await build("Owner Lan", HOLD)
        const agent = await build("Owner Lan", HOLD)

        await expect(person.service.release("ws-1", "conv-1", "person")).resolves.toMatchObject({ person: "Owner Lan", agentId: null })
        await expect(agent.service.release("ws-1", "conv-1", "agent")).resolves.toMatchObject({ person: null, agentId: "agent-sales" })
        expect(person.holds.free).not.toHaveBeenCalled()
        expect(agent.conversations.setHolder).not.toHaveBeenCalled()
    })

    it("answers nothing_held when nobody holds it (a repeat writes nothing), and not_found for a conversation of no workspace", async () => {
        const free = await build(null, null)
        const missing = await build(null, null, false)

        await expect(free.service.release("ws-1", "conv-1", "both")).resolves.toEqual({
            outcome: "nothing_held",
            person: null,
            agentId: null,
        })
        await expect(missing.service.release("ws-1", "conv-x", "both")).resolves.toMatchObject({ outcome: "not_found" })
        expect(free.conversations.setHolder).not.toHaveBeenCalled()
        expect(free.holds.free).not.toHaveBeenCalled()
        expect(missing.holds.holderOf).not.toHaveBeenCalled()
    })
})
