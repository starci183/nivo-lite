import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentWakeService } from "@modules/domain/agent-work"
import { ChatConversationsService } from "@modules/domain/chat-records"
import { frozenFreezeOf, pendingLineOf, pendingPaymentOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { LeadFreezeWakesService } from "./lead-freeze-wakes.service"

const FREEZE = frozenFreezeOf({ episode: 2 })

const EVENT = pendingLineOf({ context: { conversationId: "c-1", messageId: "m-2", lookupName: false, locale: "vi" } })

const build = async () => {
    const wakes = mock<AgentWakeService>({ write: jest.fn().mockResolvedValue("wake-new") })
    const conversations = mock<ChatConversationsService>({ setHolder: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezeWakesService,
            { provide: AgentWakeService, useValue: wakes },
            { provide: ChatConversationsService, useValue: conversations },
        ],
    }).compile()
    return { service: moduleRef.get(LeadFreezeWakesService), wakes, conversations }
}

describe("LeadFreezeWakesService", () => {
    it("writes the held events again as wakes of the same agents, in order, each under its key marked with the freeze", async () => {
        const { service, wakes } = await build()
        const tx = mockEntityManager()
        const payment = pendingPaymentOf({ actorMemberId: "member-1" })
        wakes.write.mockResolvedValueOnce("w-1").mockResolvedValueOnce(null)

        await expect(service.replay(tx, "ws-1", FREEZE, [EVENT, payment])).resolves.toBe(1)

        expect(wakes.write.mock.calls).toEqual([
            [
                tx,
                {
                    workspaceId: "ws-1",
                    agentId: "chatbot",
                    source: "customer",
                    eventKey: "msg-2~after-freeze-freeze-1-2",
                    context: { conversationId: "c-1", messageId: "m-2", lookupName: false, locale: "vi" },
                    actorMemberId: null,
                    scopeKey: "conversation:c-1",
                },
            ],
            [
                tx,
                {
                    workspaceId: "ws-1",
                    agentId: "accounting",
                    source: "tag",
                    eventKey: "bank-feed:conn-1:e-1~after-freeze-freeze-1-2",
                    context: { subject: "bank-transaction:tx-1", tagSource: "bank_feed" },
                    actorMemberId: "member-1",
                },
            ],
        ])
    })

    it("drops a kept member no wake context holds, as a flag where a text belongs or an unknown language", async () => {
        const { service, wakes } = await build()
        const odd = pendingLineOf({ context: { conversationId: "c-1", locale: "fr", text: true, lookupName: true } })

        await service.replay(mockEntityManager(), "ws-1", FREEZE, [odd])

        expect(wakes.write.mock.calls[0]?.[1].context).toEqual({ conversationId: "c-1", lookupName: true })
    })

    it("hands the conversation to the person who took it over", async () => {
        const { service, conversations } = await build()
        await service.takeOver("ws-1", "c-1", "Owner")
        expect(conversations.setHolder).toHaveBeenCalledWith("ws-1", "c-1", "Owner")
    })
})
