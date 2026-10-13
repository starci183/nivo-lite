import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BookingChatLookupService } from "./booking-chat-lookup.service"
import { SELECT_NEXT_CHAT_BOOKING } from "./persistence/booking-write.sql"
import type { CancellableBookingRow } from "./persistence/booking.rows"

const WORKSPACE = "ws-1"
const CONVERSATION = "conversation-1"
const NOW = Date.UTC(2026, 9, 11, 5, 0)
const MONDAY_NINE = "2026-10-12T02:00:00.000Z"
const NEXT_ROW: CancellableBookingRow = {
    id: "b-next",
    lead_id: "lead-1",
    customer_name: "Mai",
    service_name: "Cut",
    start_ms: Date.parse(MONDAY_NINE),
}

const build = async (rows: ReadonlyArray<CancellableBookingRow> = []) => {
    const entityManager = mockEntityManager({ query: [[SELECT_NEXT_CHAT_BOOKING, rows]] })
    const moduleRef = await Test.createTestingModule({
        providers: [BookingChatLookupService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(BookingChatLookupService), entityManager }
}

describe("BookingChatLookupService", () => {
    describe("nextOfChat", () => {
        it.each(["lead-1", null])("maps the next booking for a chat with lead %s", async (leadId) => {
            const { service, entityManager } = await build([{ ...NEXT_ROW, lead_id: leadId }])
            await expect(
                service.nextOfChat({ workspaceId: WORKSPACE, leadId, conversationId: CONVERSATION }, NOW),
            ).resolves.toEqual({
                id: "b-next",
                leadId,
                customerName: "Mai",
                serviceName: "Cut",
                startIso: MONDAY_NINE,
            })
            expect(entityManager.query).toHaveBeenCalledWith(SELECT_NEXT_CHAT_BOOKING, [
                WORKSPACE,
                leadId,
                CONVERSATION,
                new Date(NOW).toISOString(),
            ])
            expect(entityManager.query).toHaveBeenCalledTimes(1)
        })

        it("answers null when the chat has no open future booking", async () => {
            const { service, entityManager } = await build()
            await expect(
                service.nextOfChat({ workspaceId: WORKSPACE, leadId: "lead-1", conversationId: CONVERSATION }, NOW),
            ).resolves.toBeNull()
            expect(entityManager.query).toHaveBeenCalledWith(SELECT_NEXT_CHAT_BOOKING, [
                WORKSPACE,
                "lead-1",
                CONVERSATION,
                new Date(NOW).toISOString(),
            ])
            expect(entityManager.query).toHaveBeenCalledTimes(1)
        })
    })
})
