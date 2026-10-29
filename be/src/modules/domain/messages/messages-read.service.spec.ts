import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MessagesReadService } from "./messages-read.service"

const READER = { userId: "u-1", displayName: "Mai Linh" }
const QUIET = {
    unread: 0,
    unread_mention_bodies: [],
    last_body: null,
    last_author: null,
    last_author_user_id: null,
    last_at: null,
}
const NEWEST = {
    room: "sales",
    last_body: "hello",
    last_author: "An",
    last_author_user_id: "u-2",
    last_at: "2026-10-29T10:00:00+00:00",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [MessagesReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(MessagesReadService)
}

describe("MessagesReadService > activityOfWorkspace", () => {
    it("answers the unread lines since the mark and the newest line of the whole workspace", async () => {
        const em = mockEntityManager()
        const [unread, newest] = queueSubQueryBuilders(em, [
            { getRawOne: { unread: 2, mentions: ["@Bot hi"] } },
            { getRawOne: NEWEST },
        ])

        await expect(
            (await build(em)).activityOfWorkspace("ws-1", READER, "2026-10-29T09:00:00.123456+00:00"),
        ).resolves.toEqual({
            unread: 2,
            unread_mention_bodies: ["@Bot hi"],
            last_body: "hello",
            last_author: "An",
            last_author_user_id: "u-2",
            last_at: "2026-10-29T10:00:00+00:00",
        })
        expect(unread?.argsOf("where")).toContainEqual(["m.workspace_id = :workspaceId", { workspaceId: "ws-1" }])
        expect(unread?.argsOf("andWhere")).toContainEqual([
            "m.created_at > COALESCE(CAST(:readAt AS timestamptz), '-infinity'::timestamptz)",
            { readAt: "2026-10-29T09:00:00.123456+00:00" },
        ])
        expect(newest?.argsOf("orderBy")).toContainEqual(["m.created_at", "DESC"])
        expect(newest?.argsOf("limit")).toContainEqual([1])
    })

    it("answers the quiet activity when the workspace has no line", async () => {
        const em = mockEntityManager()
        queueSubQueryBuilders(em, [{ getRawOne: undefined }, { getRawOne: undefined }])

        await expect((await build(em)).activityOfWorkspace("ws-1", READER, null)).resolves.toEqual(QUIET)
    })
})

describe("MessagesReadService > activityOfRooms", () => {
    it("asks for nothing when no room is given", async () => {
        const em = mockEntityManager()

        await expect((await build(em)).activityOfRooms("ws-1", READER, [])).resolves.toEqual(new Map())
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("answers each room with its unread lines and newest line, and a quiet room without either", async () => {
        const em = mockEntityManager()
        const [unread, newest] = queueSubQueryBuilders(em, [
            { getRawMany: [{ scope: "sales", unread: 3, mentions: null }] },
            { getRawMany: [NEWEST] },
        ])
        const marks = [
            { key: "sales", readAt: "2026-10-29T09:00:00+00:00" },
            { key: "hr", readAt: null },
        ]

        const activity = await (await build(em)).activityOfRooms("ws-1", READER, marks)

        expect(activity.get("sales")).toEqual({ ...QUIET, ...NEWEST, room: undefined, unread: 3 })
        expect(activity.get("hr")).toEqual(QUIET)
        expect(unread?.argsOf("groupBy")).toContainEqual(["m.room"])
        expect(unread?.argsOf("andWhere")).toContainEqual(["m.room IN (:...rooms)", { rooms: ["sales", "hr"] }])
        expect(unread?.argsOf("andWhere")).toContainEqual([
            expect.stringContaining("unnest(CAST(:markScopes AS text[]), CAST(:markReadAts AS timestamptz[]))"),
            { markScopes: ["sales", "hr"], markReadAts: ["2026-10-29T09:00:00+00:00", null] },
        ])
        expect(unread?.argsOf("andWhere")).toContainEqual([
            expect.stringContaining("IS DISTINCT FROM :userId"),
            READER,
        ])
        expect(newest?.argsOf("distinctOn")).toContainEqual([["m.room"]])
        expect(newest?.argsOf("addOrderBy")).toContainEqual(["m.created_at", "DESC"])
    })
})

describe("MessagesReadService > unreadOfLeads", () => {
    it("answers the customer conversations with unread lines in lead order, bounded", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ scope: "l-1", unread: 2, mentions: null }] }])

        await expect(
            (await build(em)).unreadOfLeads("ws-1", READER, [{ key: "l-1", readAt: null }], 500),
        ).resolves.toEqual([{ lead_id: "l-1", unread: 2 }])
        expect(read?.argsOf("groupBy")).toContainEqual(["m.lead_id"])
        expect(read?.argsOf("andWhere")).toContainEqual(["m.lead_id IS NOT NULL"])
        expect(read?.argsOf("orderBy")).toContainEqual(["m.lead_id"])
        expect(read?.argsOf("limit")).toContainEqual([500])
    })
})

describe("MessagesReadService > page", () => {
    it("reads the newest lines of the workspace, one more than the page size", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [{ id: "m-1" }] }])

        await expect((await build(em)).page("ws-1", { room: null, before: null, size: 30 })).resolves.toEqual([
            { id: "m-1" },
        ])
        expect(read?.argsOf("where")).toContainEqual(["m.workspace_id = :workspaceId", { workspaceId: "ws-1" }])
        expect(read?.argsOf("andWhere")).toEqual([])
        expect(read?.argsOf("orderBy")).toContainEqual(["m.created_at", "DESC"])
        expect(read?.argsOf("limit")).toContainEqual([31])
    })

    it("pages one room before a position", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [] }])
        const before = { createdAt: "2026-10-29T10:00:00+00:00", id: "m-9" }

        await (await build(em)).page("ws-1", { room: "sales", before, size: 10 })

        expect(read?.argsOf("andWhere")).toContainEqual(["m.room = :room", { room: "sales" }])
        expect(read?.argsOf("andWhere")).toContainEqual([
            "(m.created_at, m.id) < (CAST(:beforeAt AS timestamptz), CAST(:beforeId AS uuid))",
            { beforeAt: before.createdAt, beforeId: "m-9" },
        ])
    })
})

describe("MessagesReadService > textOf", () => {
    it("reads the author and text of one message of the workspace", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawOne: { id: "m-1", author_kind: "human", body: "hi" } }])

        await expect((await build(em)).textOf("ws-1", "m-1")).resolves.toEqual({
            id: "m-1",
            author_kind: "human",
            body: "hi",
        })
        expect(read?.argsOf("where")).toContainEqual([
            "m.workspace_id = :workspaceId AND m.id = :messageId",
            { workspaceId: "ws-1", messageId: "m-1" },
        ])
    })
})
