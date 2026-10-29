import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { InboundEventFeedRecord } from "./inbound-events.contracts"
import { InboxFeedService } from "./inbox-feed.service"

const member = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: null,
    displayName: "Minh",
    status: "active",
})

const row = builder<InboundEventFeedRecord>({
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
    const entityManager = mockEntityManager()
    const [query] = queueQueryBuilders(entityManager, [{ getRawMany: [row()] }])
    const moduleRef = await Test.createTestingModule({
        providers: [
            InboxFeedService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
        ],
    }).compile()
    return { service: moduleRef.get(InboxFeedService), members, entityManager, query }
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
            const { service, members, query } = await build()
            const feed = [row()]

            await expect(service.list("user-1", "ws-1", limit)).resolves.toEqual(feed)

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1"]])
            expect(query?.callsOf("limit")).toEqual([[bounded]])
            expect(query?.callsOf("where")).toEqual([["e.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
            expect(query?.callsOf("addSelect")).toContainEqual([
                `to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`,
                "created_at",
            ])
            expect(query?.callsOf("addSelect")).toContainEqual(["e.amount_vnd::float8", "amount_vnd"])
            expect(query?.callsOf("orderBy")).toEqual([["e.createdAt", "DESC"]])
            expect(query?.callsOf("addOrderBy")).toEqual([["e.id", "DESC"]])
        })

        it("does not read the feed when membership is refused", async () => {
            const { service, members, entityManager } = await build()
            const cause = new Error("not a member")
            members.require.mockRejectedValue(cause)

            await expect(service.list("user-1", "ws-1", 20)).rejects.toBe(cause)

            expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
})
