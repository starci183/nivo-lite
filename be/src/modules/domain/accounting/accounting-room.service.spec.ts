import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OfficeLinesService } from "@modules/domain/messages"
import { AccountingRoomService } from "./accounting-room.service"
import { buildDailySummary } from "./daily-summary.policy"

const build = async () => {
    const lines = mock<OfficeLinesService>({ post: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [AccountingRoomService, { provide: OfficeLinesService, useValue: lines }],
    }).compile()
    return { room: moduleRef.get(AccountingRoomService), lines }
}

describe("AccountingRoomService", () => {
    it("speaks as the accounting agent, a card as its text", async () => {
        const { room, lines } = await build()
        const card = buildDailySummary({
            day: "2026-10-20",
            valid: 1,
            needsReview: 0,
            invalidTaxCode: 0,
            matched: 0,
            unmatched: 0,
            upcoming: [],
        })

        await room.post("ws-1", "reminder")
        await expect(room.postCard("ws-1", card.hub, card.text)).resolves.toBe(card.hub)

        expect(lines.post).toHaveBeenNthCalledWith(
            1,
            { workspaceId: "ws-1" },
            { body: "reminder", lead_id: null, work_item_id: null, dept: "accounting" },
        )
        expect(lines.post).toHaveBeenNthCalledWith(
            2,
            { workspaceId: "ws-1" },
            { body: card.text, lead_id: null, work_item_id: null, dept: "accounting" },
        )
    })
})
