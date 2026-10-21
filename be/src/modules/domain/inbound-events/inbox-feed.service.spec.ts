import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InboxFeedService } from "./inbox-feed.service"
import type { InboundEventFeedRow } from "./persistence/inbound-events.rows"
import { LIST_INBOUND_EVENTS } from "./persistence/inbound-events.sql"

const member = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: null,
    displayName: "Minh",
    status: "active",
})

const row = builder<InboundEventFeedRow>({
    id: "event-1",
    workspace_id: "ws-1",
    channel: "telegram",
    kind: "message",
    sender_name: "Minh",
    sender_contact: null,
    body: "Hello",
    amount_vnd: null,
    external_ref: null,
    event_id: "tg-1",
    lead_id: null,
    status: "received",
    duplicate_count: 0,
    created_at: "2026-10-13T10:00:00.000Z",
})

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(member())
    const entityManager = mockEntityManager({ query: [LIST_INBOUND_EVENTS, [row()]] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboxFeedService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
        ],
    }).compile()
    return { service: moduleRef.get(InboxFeedService), members, entityManager }
}

describe("InboxFeedService", () => {
    describe("list", () => {
        it.each([
            [0, 1],
            [-3.2, 1],
            [1, 1],
            [1.9, 1],
            [40, 40],
            [100, 100],
            [100.9, 100],
            [250, 100],
        ] as const)("lists the member's feed with the limit %s bounded to %s", async (limit, bounded) => {
            const { service, members, entityManager } = await build()
            const feed = [row()]

            await expect(service.list("user-1", "ws-1", limit)).resolves.toEqual(feed)

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1"]])
            expect(entityManager.query.mock.calls).toEqual([[LIST_INBOUND_EVENTS, ["ws-1", bounded]]])
        })

        it("does not read the feed when membership is refused", async () => {
            const { service, members, entityManager } = await build()
            const cause = new Error("not a member")
            members.require.mockRejectedValue(cause)

            await expect(service.list("user-1", "ws-1", 20)).rejects.toBe(cause)

            expect(entityManager.query).not.toHaveBeenCalled()
        })
    })
})
