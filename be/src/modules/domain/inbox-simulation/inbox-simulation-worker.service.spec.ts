import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import { InboundEventsService, type OptionalInboundEvent } from "@modules/domain/inbound-events"
import { WorkItemsService } from "@modules/domain/work-items"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { SimulateInboundPayload } from "@modules/queues/decisions"
import { InboxSimulationErrorCode } from "./errors/inbox-simulation.error"
import { InboxSimulationWorkerService } from "./inbox-simulation-worker.service"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
}

const PAYLOAD: SimulateInboundPayload = {
    kind: "simulate_inbound",
    workspaceId: "ws-1",
    userId: "user-1",
    locale: "vi",
    inboundEventId: "in-1",
    items: "",
}

const LIVE: NonNullable<OptionalInboundEvent> = {
    id: "in-1",
    workspace_id: "ws-1",
    channel: "zalo",
    kind: "message",
    origin: "live",
    sender_name: null,
    sender_contact: null,
    body: "hello",
    amount_vnd: null,
    external_ref: null,
    event_id: "evt-1",
    lead_id: null,
    status: "stored",
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(MEMBER)
    const inboundEvents = mock<InboundEventsService>()
    inboundEvents.find.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboxSimulationWorkerService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InboundEventsService, useValue: inboundEvents },
            { provide: WorkEngineService, useValue: mock<WorkEngineService>() },
            { provide: WorkItemsService, useValue: mock<WorkItemsService>() },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
        ],
    }).compile()
    return { service: moduleRef.get(InboxSimulationWorkerService), inboundEvents }
}

describe("InboxSimulationWorkerService", () => {
    it("refuses a simulation whose stored event is missing", async () => {
        const { service } = await build()

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({ code: InboxSimulationErrorCode.NotFound })
    })

    it("refuses a stored event that was not simulated", async () => {
        const { service, inboundEvents } = await build()
        inboundEvents.find.mockResolvedValue(LIVE)

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({ code: InboxSimulationErrorCode.NotFound })
    })
})
