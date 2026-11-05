import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
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
    it("keeps one open owner work item per outage of a connection, named after the connection, in the series of the connection", async () => {
        const { service, connections, inboundEvents } = await build()
        connections.find.mockResolvedValue(connectionRecord({ name: "OA Hoa Tuoi", provider: "zalo_oa" }))

        await expect(service.planBlocked(TARGET)).resolves.toBeUndefined()

        expect(inboundEvents.keepOutageForOwner).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            channel: "zalo",
            sender: "OA Hoa Tuoi",
            body: CHANNEL_PLAN_NOTICE,
            eventId: "channel-plan:c-1",
        })
    })

    it("names the channel when the connection is gone, and does nothing for a conversation with no connection", async () => {
        const { service, connections, inboundEvents } = await build()
        connections.find.mockResolvedValue(null)

        await service.planBlocked(TARGET)
        await service.planBlocked({ ...TARGET, connectionId: null })

        expect(inboundEvents.keepOutageForOwner).toHaveBeenCalledTimes(1)
        expect(inboundEvents.keepOutageForOwner).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ sender: "zalo" }),
        )
    })

    it("closes the open item of the outage of the connection once a reply reaches a customer there, and does nothing without a connection", async () => {
        const { service, inboundEvents } = await build()

        await expect(service.recovered(TARGET)).resolves.toBeUndefined()
        await expect(service.recovered({ ...TARGET, connectionId: null })).resolves.toBeUndefined()

        expect(inboundEvents.closeOutage).toHaveBeenCalledTimes(1)
        expect(inboundEvents.closeOutage).toHaveBeenCalledWith("ws-1", "zalo", "channel-plan:c-1")
    })
})
