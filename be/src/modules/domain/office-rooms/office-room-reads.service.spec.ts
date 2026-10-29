import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { MessagesReadService } from "@modules/domain/messages"
import type { LineActivity } from "@modules/domain/messages"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OFFICE_ROOMS_AGENTS, OFFICE_ROOMS_TEST_CHATS } from "./office-rooms.decorators"
import type { RoomsAgentChats, RoomsAgents, RoomsChatLine, RoomsTestChats } from "./office-rooms.port"
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

const lineOf = (id: string, extra: Partial<RoomsChatLine> = {}): RoomsChatLine => ({
    id,
    body: `line ${id}`,
    author_user_id: "u-2",
    author_name: null,
    at: `at ${id}`,
    ...extra,
})

/** What the owner capabilities answer. */
interface Answers {
    readonly workspace?: LineActivity
    readonly rooms?: ReadonlyMap<string, LineActivity>
    readonly leads?: Array<{ lead_id: string; unread: number }>
    readonly agentIds?: Array<string>
    readonly chats?: Array<RoomsAgentChats>
    readonly names?: Array<{ userId: string; displayName: string }>
}

const build = async (entityManager: MockEntityManager, answers: Answers = {}) => {
    const messages = mock<MessagesReadService>({
        activityOfWorkspace: jest.fn(() => Promise.resolve(answers.workspace ?? BUSY)),
        activityOfRooms: jest.fn(() => Promise.resolve(answers.rooms ?? new Map<string, LineActivity>())),
        unreadOfLeads: jest.fn(() => Promise.resolve(answers.leads ?? [])),
    })
    const agents = mock<RoomsAgents>({ idsOf: jest.fn(() => Promise.resolve(answers.agentIds ?? [])) })
    const testChats = mock<RoomsTestChats>({ activityOf: jest.fn(() => Promise.resolve(answers.chats ?? [])) })
    const members = mock<WorkspaceMembersReadService>({ namesOf: jest.fn(() => Promise.resolve(answers.names ?? [])) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeRoomReadsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MessagesReadService, useValue: messages },
            { provide: OFFICE_ROOMS_AGENTS, useValue: agents },
            { provide: OFFICE_ROOMS_TEST_CHATS, useValue: testChats },
            { provide: WorkspaceMembersReadService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeRoomReadsService), messages, agents, testChats, members }
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

describe("OfficeRoomReadsService.agentConversations", () => {
    it("lists every agent with the unread lines of its test chats and the newest line, named after its author", async () => {
        const em = mockEntityManager()
        const [marks] = queueSubQueryBuilders(em, [
            { getRawMany: [{ room: "agent:a-1", read_at: "2026-10-29T09:00:00.123456+00:00" }] },
        ])
        const { service, agents, testChats, members } = await build(em, {
            agentIds: ["a-1", "a-2", "a-3", "a-4", "a-5"],
            chats: [
                { agentId: "a-1", unread: 99, newest: lineOf("m-2") },
                { agentId: "a-2", unread: 1, newest: lineOf("m-3", { author_user_id: null, author_name: "Bot" }) },
                { agentId: "a-3", unread: 0, newest: lineOf("m-4", { author_user_id: null }) },
                { agentId: "a-4", unread: 0, newest: undefined },
                { agentId: "a-5", unread: 0, newest: lineOf("m-5", { author_user_id: "u-9" }) },
            ],
            names: [{ userId: "u-2", displayName: "An" }],
        })

        await expect(service.agentConversations("ws-1", "u-1", "Mai Linh")).resolves.toEqual([
            {
                id: "a-1",
                unread: 99,
                last_body: "line m-2",
                last_author_id: "u-2",
                last_author: "An",
                last_at: "at m-2",
            },
            {
                id: "a-2",
                unread: 1,
                last_body: "line m-3",
                last_author_id: null,
                last_author: "Bot",
                last_at: "at m-3",
            },
            { id: "a-3", unread: 0, last_body: "line m-4", last_author_id: null, last_author: null, last_at: "at m-4" },
            { id: "a-4", unread: 0, last_body: null, last_author_id: null, last_author: null, last_at: null },
            {
                id: "a-5",
                unread: 0,
                last_body: "line m-5",
                last_author_id: "u-9",
                last_author: null,
                last_at: "at m-5",
            },
        ])
        expect(agents.idsOf).toHaveBeenCalledWith("ws-1", 100)
        expect(marks?.argsOf("andWhere")).toContainEqual(["rd.room LIKE 'agent:%'"])
        expect(testChats.activityOf).toHaveBeenCalledWith("ws-1", READER, [
            { agentId: "a-1", readAt: "2026-10-29T09:00:00.123456+00:00" },
            { agentId: "a-2", readAt: null },
            { agentId: "a-3", readAt: null },
            { agentId: "a-4", readAt: null },
            { agentId: "a-5", readAt: null },
        ])
        expect(members.namesOf).toHaveBeenCalledWith("ws-1", ["u-2", "u-9"])
    })

    it("lists no conversation for a workspace without agents", async () => {
        const em = mockEntityManager()
        queueSubQueryBuilders(em, [{ getRawMany: [] }])
        const { service } = await build(em)

        await expect(service.agentConversations("ws-1", "u-1", "Mai Linh")).resolves.toEqual([])
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
