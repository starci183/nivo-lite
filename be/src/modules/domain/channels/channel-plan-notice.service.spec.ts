import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ChannelPlanNoticeService } from "./channel-plan-notice.service"
import { CHANNEL_PLAN_NOTICE } from "./messages/channels.messages"

const TARGET = { id: "conv-1", workspaceId: "ws-1", channel: "zalo", externalId: "123", connectionId: "c-1" }

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const connections = mock<ConnectionsService>()
    const inboundEvents = mock<InboundEventsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelPlanNoticeService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: ConnectionsService, useValue: connections },
            { provide: InboundEventsService, useValue: inboundEvents },
        ],
    }).compile()
    return { service: moduleRef.get(ChannelPlanNoticeService), connections, inboundEvents }
}

describe("ChannelPlanNoticeService", () => {
    it("keeps one owner work item per connection, named after the connection, whose event id is the connection", async () => {
        const { service, connections, inboundEvents } = await build()
        connections.find.mockResolvedValue({ name: "OA Hoa Tươi" } as never)

        await service.planBlocked(TARGET)

        expect(inboundEvents.keepForOwner).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            channel: "zalo",
            sender: "OA Hoa Tươi",
            body: CHANNEL_PLAN_NOTICE,
            eventId: "channel-plan:c-1",
        })
        expect(CHANNEL_PLAN_NOTICE).toContain("nâng gói OA")
    })

    it("names the channel when the connection is gone, and does nothing for a conversation with no connection", async () => {
        const { service, connections, inboundEvents } = await build()
        connections.find.mockResolvedValue(null)

        await service.planBlocked(TARGET)
        await service.planBlocked({ ...TARGET, connectionId: null })

        expect(inboundEvents.keepForOwner).toHaveBeenCalledTimes(1)
        expect(inboundEvents.keepForOwner).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ sender: "zalo" }),
        )
    })
})
