import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OfficeCardsService, OfficeLinesService } from "@modules/domain/messages"
import { AccountingRoomService, officeCardOf } from "./accounting-room.service"
import type { HubCardPayload } from "./accounting-desk.contracts"
import { buildDailySummary } from "./daily-summary.policy"

type PostedCardView = Awaited<ReturnType<OfficeCardsService["postAsDepartment"]>>

const posted: PostedCardView = { id: "m-1", room: "accounting" }

const build = async () => {
    const lines = mock<OfficeLinesService>({ post: jest.fn(() => Promise.resolve()) })
    const cards = mock<OfficeCardsService>({
        postAsDepartment: jest.fn(() => Promise.resolve(posted)),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountingRoomService,
            { provide: OfficeLinesService, useValue: lines },
            { provide: OfficeCardsService, useValue: cards },
        ],
    }).compile()
    return { room: moduleRef.get(AccountingRoomService), lines, cards }
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
    it("speaks a line as the accounting agent", async () => {
        const { room, lines } = await build()

        await room.post("ws-1", "reminder")

        expect(lines.post).toHaveBeenCalledWith(
            { workspaceId: "ws-1" },
            { body: "reminder", lead_id: null, work_item_id: null, dept: "accounting" },
        )
    })

    it("posts a card into the accounting room with its text as the preview", async () => {
        const { room, cards } = await build()
        const card = summary()

        await expect(room.postCard("ws-1", card.hub, card.text)).resolves.toBe(card.hub)

        expect(cards.postAsDepartment).toHaveBeenCalledWith({ workspaceId: "ws-1" }, "accounting", {
            room: "accounting",
            body: card.text,
            leadId: null,
            workItemId: null,
            card: officeCardOf(card.hub),
        })
    })

    it("gives every card line a marker", () => {
        const card: HubCardPayload = {
            v: 1,
            type: "exception",
            title: "t",
            lines: [{ text: "a" }, { at: "x", text: "b" }],
        }

        expect(officeCardOf(card).lines).toEqual([
            { at: "", text: "a" },
            { at: "x", text: "b" },
        ])
        expect(officeCardOf({ v: 1, type: "exception", title: "t" })).toEqual({ v: 1, type: "exception", title: "t" })
    })
})
