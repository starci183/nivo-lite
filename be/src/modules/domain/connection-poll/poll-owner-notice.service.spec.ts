import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { POLL_NEEDS_REAUTH_REASON } from "./messages/connection-poll.messages"
import { PollOwnerNoticeService } from "./poll-owner-notice.service"

const record = { id: "c-1", workspaceId: "ws-1", provider: "sepay", name: "SePay VCB" } as ConnectionRecord

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
        expect(inboundEvents.keepForOwner).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            channel: "sepay",
            sender: "SePay VCB",
            body: POLL_NEEDS_REAUTH_REASON,
            eventId: "reauth:c-1:1762240000000",
        })
        expect(tx.commits).toBe(1)
    })
})
