import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { MessagesReadService } from "@modules/domain/messages"
import type { LineActivity } from "@modules/domain/messages"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OfficeRoomReadsService } from "./office-room-reads.service"

const READER = { userId: "u-1", displayName: "Mai Linh" }
const QUIET = {
    unread: 0,
    unread_mention_bodies: [],
    last_body: null,
    last_author: null,
    last_author_user_id: null,
    last_at: null,
}
const BUSY: LineActivity = {
    unread: 4,
    unread_mention_bodies: ["@Bot hi"],
    last_body: "hello",
    last_author: "An",
    last_author_user_id: "u-2",
    last_at: "2026-10-29T10:00:00+00:00",
}

/** What the owner capabilities answer. */
interface Answers {
    readonly workspace?: LineActivity
    readonly rooms?: ReadonlyMap<string, LineActivity>
    readonly leads?: Array<{ lead_id: string; unread: number }>
}

const build = async (entityManager: MockEntityManager, answers: Answers = {}) => {
    const messages = mock<MessagesReadService>({
        activityOfWorkspace: jest.fn(() => Promise.resolve(answers.workspace ?? BUSY)),
        activityOfRooms: jest.fn(() => Promise.resolve(answers.rooms ?? new Map<string, LineActivity>())),
        unreadOfLeads: jest.fn(() => Promise.resolve(answers.leads ?? [])),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeRoomReadsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MessagesReadService, useValue: messages },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeRoomReadsService), messages }
}

describe("OfficeRoomReadsService.rooms", () => {
    const row = {
        key: "sales",
        name: "Sales",
        position: 1,
        agent_ids: ["a-1"],
        home_agent_ids: [],
        user_ids: ["u-1"],
        pins: [],
        read_at: "2026-10-29T09:00:00.123456+00:00",
    }

    it("reads the department rooms in list order, at most twenty, and attaches the lines of each", async () => {
        const em = mockEntityManager()
        const [read] = queueSubQueryBuilders(em, [{ getRawMany: [row, { ...row, key: "hr", read_at: null }] }])
        const { service, messages } = await build(em, { rooms: new Map([["sales", BUSY]]) })

        await expect(service.rooms("ws-1", "u-1", "Mai Linh")).resolves.toEqual([
            {
                ...BUSY,
                key: "sales",
                name: "Sales",
                position: 1,
                agent_ids: ["a-1"],
                home_agent_ids: [],
                user_ids: ["u-1"],
                pins: [],
            },
            {
                ...QUIET,
                key: "hr",
                name: "Sales",
                position: 1,
                agent_ids: ["a-1"],
                home_agent_ids: [],
                user_ids: ["u-1"],
                pins: [],
            },
        ])
        expect(read?.argsOf("where")).toContainEqual(["r.workspace_id = :workspaceId"])
        expect(read?.argsOf("setParameters")).toContainEqual([{ workspaceId: "ws-1", userId: "u-1" }])
        expect(read?.argsOf("orderBy")).toContainEqual(["r.position"])
        expect(read?.argsOf("addOrderBy")).toContainEqual(["r.key"])
        expect(read?.argsOf("limit")).toContainEqual([20])
        expect(messages.activityOfRooms).toHaveBeenCalledWith("ws-1", READER, [
            { key: "sales", readAt: "2026-10-29T09:00:00.123456+00:00" },
            { key: "hr", readAt: null },
        ])
    })
})

describe("OfficeRoomReadsService.summary", () => {
    it("reads the lines of the whole workspace since the caller's Office marker", async () => {
        const em = mockEntityManager()
        const [marker] = queueSubQueryBuilders(em, [
            { getRawMany: [{ room: "", read_at: "2026-10-29T09:00:00.123456+00:00" }] },
        ])
        const { service, messages } = await build(em)

        await expect(service.summary("ws-1", "u-1", "Mai Linh")).resolves.toEqual(BUSY)
        expect(marker?.argsOf("andWhere")).toContainEqual(["rd.room = ''"])
        expect(messages.activityOfWorkspace).toHaveBeenCalledWith("ws-1", READER, "2026-10-29T09:00:00.123456+00:00")
    })

    it("counts every line unread while the caller has no marker", async () => {
        const em = mockEntityManager()
        queueSubQueryBuilders(em, [{ getRawMany: [] }])
        const { service, messages } = await build(em)

        await service.summary("ws-1", "u-1", "Mai Linh")

        expect(messages.activityOfWorkspace).toHaveBeenCalledWith("ws-1", READER, null)
    })
})

describe("OfficeRoomReadsService.leadConversations", () => {
    it("answers the customer conversations with unread lines, read from the caller's lead markers", async () => {
        const em = mockEntityManager()
        const [marks] = queueSubQueryBuilders(em, [
            { getRawMany: [{ room: "lead:l-1", read_at: "2026-10-29T09:00:00.123456+00:00" }] },
        ])
        const { service, messages } = await build(em, { leads: [{ lead_id: "l-1", unread: 2 }] })

        await expect(service.leadConversations("ws-1", "u-1", "Mai Linh")).resolves.toEqual([{ id: "l-1", unread: 2 }])
        expect(marks?.argsOf("andWhere")).toContainEqual(["rd.room LIKE 'lead:%'"])
        expect(messages.unreadOfLeads).toHaveBeenCalledWith(
            "ws-1",
            READER,
            [{ key: "l-1", readAt: "2026-10-29T09:00:00.123456+00:00" }],
            500,
        )
    })
})
