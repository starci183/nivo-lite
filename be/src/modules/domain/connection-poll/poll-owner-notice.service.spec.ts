import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { POLL_NEEDS_PERMISSION_REASON, POLL_NEEDS_REAUTH_REASON } from "./messages/connection-poll.messages"
import { PollOwnerNoticeService } from "./poll-owner-notice.service"

const record: ConnectionRecord = {
    id: "c-1",
    workspaceId: "ws-1",
    provider: "sepay",
    name: "SePay VCB",
    meta: {},
    status: "connected",
    lastError: null,
    environment: "live",
    sandbox: false,
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-03T00:00:00.000Z",
}

describe("PollOwnerNoticeService needsReauth", () => {
    it("marks the connection failing with the reason and keeps one owner work item per outage", async () => {
        const connections = mock<ConnectionsService>()
        const inboundEvents = mock<InboundEventsService>()
        const tx = fakeTransaction(mockEntityManager())
        const moduleRef = await Test.createTestingModule({
            providers: [
                PollOwnerNoticeService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
                { provide: ConnectionsService, useValue: connections },
                { provide: InboundEventsService, useValue: inboundEvents },
            ],
        }).compile()

        await moduleRef.get(PollOwnerNoticeService).needsReauth(record, 1_762_240_000_000)

        expect(connections.markFailing).toHaveBeenCalledWith("c-1", POLL_NEEDS_REAUTH_REASON)
        expect(connections.markHealth).toHaveBeenCalledWith(
            "c-1",
            expect.objectContaining({ state: "needs_reauth", reason: POLL_NEEDS_REAUTH_REASON }),
        )
        expect(inboundEvents.keepForOwner).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            channel: "sepay",
            sender: "SePay VCB",
            body: POLL_NEEDS_REAUTH_REASON,
            eventId: "reauth:c-1:1762240000000",
        })
        expect(tx.commits).toBe(1)
    })

    it("asks the owner to grant the permission to read messages when that is what is missing", async () => {
        const connections = mock<ConnectionsService>()
        const inboundEvents = mock<InboundEventsService>()
        const tx = fakeTransaction(mockEntityManager())
        const moduleRef = await Test.createTestingModule({
            providers: [
                PollOwnerNoticeService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
                { provide: ConnectionsService, useValue: connections },
                { provide: InboundEventsService, useValue: inboundEvents },
            ],
        }).compile()

        await moduleRef.get(PollOwnerNoticeService).needsReauth(record, 1_762_240_000_000, "permission")

        expect(connections.markFailing).toHaveBeenCalledWith("c-1", POLL_NEEDS_PERMISSION_REASON)
        expect(inboundEvents.keepForOwner).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ body: POLL_NEEDS_PERMISSION_REASON }),
        )
        expect(POLL_NEEDS_PERMISSION_REASON).not.toBe(POLL_NEEDS_REAUTH_REASON)
    })

    it("keeps one owner work item in the provider's words that the plan does not let the connection be read back, and leaves it connected", async () => {
        const connections = mock<ConnectionsService>()
        const inboundEvents = mock<InboundEventsService>()
        const tx = fakeTransaction(mockEntityManager())
        const moduleRef = await Test.createTestingModule({
            providers: [
                PollOwnerNoticeService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
                { provide: ConnectionsService, useValue: connections },
                { provide: InboundEventsService, useValue: inboundEvents },
            ],
        }).compile()

        await moduleRef.get(PollOwnerNoticeService).unavailable(record, "upgrade the plan", 1_762_240_000_000)

        expect(connections.markFailing).not.toHaveBeenCalled()
        expect(inboundEvents.keepForOwner).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            channel: "sepay",
            sender: "SePay VCB",
            body: "upgrade the plan",
            eventId: "unavailable:c-1:1762240000000",
        })
        expect(tx.commits).toBe(1)
    })
})
