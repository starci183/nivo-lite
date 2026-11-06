import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TeamChatService } from "@modules/domain/team-chat"
import { AccountingRoomService } from "./accounting-room.service"
import { buildDailySummary } from "./daily-summary.policy"

const build = async () => {
    const chat = mock<TeamChatService>({
        postAsAgent: jest.fn(() => Promise.resolve({ roomId: "r-1", messageId: "m-1", agentId: "a-1" })),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [AccountingRoomService, { provide: TeamChatService, useValue: chat }],
    }).compile()
    return { room: moduleRef.get(AccountingRoomService), chat }
}

const summary = () =>
    buildDailySummary({
        day: "2026-10-20",
        valid: 1,
        needsReview: 0,
        invalidTaxCode: 0,
        matched: 0,
        unmatched: 0,
        upcoming: [],
        tools: { invoices: null, credits: null, receivables: null },
        notConnected: [],
    })

describe("AccountingRoomService", () => {
    it("says a line as the accounting agent to the owner of the workspace", async () => {
        const { room, chat } = await build()

        await room.post("ws-1", "reminder")

        expect(chat.postAsAgent).toHaveBeenCalledWith("ws-1", {
            agent: "accounting",
            toUserId: null,
            body: "reminder",
            key: null,
        })
    })

    it("says the text of a card and answers the card itself", async () => {
        const { room, chat } = await build()
        const card = summary()

        await expect(room.postCard("ws-1", card.hub, card.text)).resolves.toBe(card.hub)

        expect(chat.postAsAgent).toHaveBeenCalledWith("ws-1", {
            agent: "accounting",
            toUserId: null,
            body: card.text,
            key: null,
        })
    })

    it("does nothing when the workspace has no accounting agent", async () => {
        const { room, chat } = await build()
        chat.postAsAgent.mockResolvedValue(null)

        await expect(room.post("ws-1", "reminder")).resolves.toBeUndefined()
    })
})
