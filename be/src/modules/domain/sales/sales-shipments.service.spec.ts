import { mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EvidenceService } from "@modules/domain/decisions"
import { OrdersErrorCode, OrdersService } from "@modules/domain/orders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { SalesShipmentsService } from "./sales-shipments.service"
import { SalesStatusService } from "./sales-status.service"

const member: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

describe("SalesShipmentsService", () => {
    const build = async () => {
        const members = mock<WorkspaceMembersService>()
        members.require.mockResolvedValue(member)
        const moduleRef = await Test.createTestingModule({
            providers: [
                SalesShipmentsService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
                { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
                { provide: QUEUE_OUTBOX, useValue: recordingQueueOutbox() },
                { provide: WorkspaceMembersService, useValue: members },
                { provide: OrdersService, useValue: mock<OrdersService>() },
                { provide: EvidenceService, useValue: mock<EvidenceService>() },
                { provide: SalesStatusService, useValue: mock<SalesStatusService>() },
            ],
        }).compile()
        return moduleRef.get(SalesShipmentsService)
    }

    it("refuses a shipment with a blank carrier", async () => {
        const service = await build()

        await expect(
            service.markShipped("user-1", {
                workspaceId: "ws-1",
                locale: "vi",
                orderId: "order-1",
                carrier: " ",
                trackingCode: "TRACK",
            }),
        ).rejects.toMatchObject({ code: OrdersErrorCode.ShipmentInvalid })
    })
})
