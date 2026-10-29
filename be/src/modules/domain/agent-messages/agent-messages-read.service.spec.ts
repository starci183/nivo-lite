import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentMessagesReadService } from "./agent-messages-read.service"

const READER = { userId: "u-1", displayName: "Mai Linh" }
const NEWEST = {
    conversation_id: "c-1",
    id: "m-1",
    body: "hello",
    author_user_id: "u-2",
    author_name: null,
    at: "2026-10-29T10:00:00+00:00",
    sort_at: "20261029100000000000",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentMessagesReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(AgentMessagesReadService)
}

describe("AgentMessagesReadService", () => {
    it("asks for nothing when no conversation is given", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).chatActivity("ws-1", READER, [])).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("answers the unread count and newest line of each conversation, quiet when it has neither", async () => {
        const em = mockEntityManager()
        const [unread, newest] = queueSubQueryBuilders(em, [
            { getRawMany: [{ conversation_id: "c-1", unread: 3 }] },
            { getRawMany: [NEWEST] },
        ])
        const marks = [
            { conversationId: "c-1", readAt: "2026-10-29T09:00:00.123456+00:00" },
            { conversationId: "c-2", readAt: null },
        ]

        await expect((await build(em)).chatActivity("ws-1", READER, marks)).resolves.toEqual([
            {
                conversationId: "c-1",
                unread: 3,
                newest: {
                    id: "m-1",
                    body: "hello",
                    author_user_id: "u-2",
                    author_name: null,
                    at: "2026-10-29T10:00:00+00:00",
                    sort_at: "20261029100000000000",
                    conversation_id: "c-1",
                },
            },
            { conversationId: "c-2", unread: 0, newest: undefined },
        ])
        expect(unread?.argsOf("where")).toContainEqual([
            "m.workspace_id = :workspaceId AND m.conversation_id IN (:...conversationIds)",
            { workspaceId: "ws-1", conversationIds: ["c-1", "c-2"] },
        ])
        expect(unread?.argsOf("andWhere")).toContainEqual([
            expect.stringContaining("unnest(CAST(:markIds AS text[]), CAST(:markReadAts AS timestamptz[]))"),
            { markIds: ["c-1", "c-2"], markReadAts: ["2026-10-29T09:00:00.123456+00:00", null] },
        ])
        expect(unread?.argsOf("andWhere")).toContainEqual([expect.stringContaining("IS DISTINCT FROM :userId"), READER])
        expect(unread?.argsOf("groupBy")).toContainEqual(["m.conversation_id"])
        expect(newest?.argsOf("distinctOn")).toContainEqual([["m.conversation_id"]])
        expect(newest?.argsOf("addOrderBy")).toContainEqual(["m.created_at", "DESC"])
    })
})
